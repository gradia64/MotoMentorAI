// Test dei fornitori di pianificazione del main (electron/main/planning.js)
// con una fetch finta: nessuna rete, nessuna chiave reale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterPlanningModels, listPlanningModels, buildPlanRequest, planTrip } from '../electron/main/planning.js';

const orModel = (id, { input = ['text', 'image'], params = ['structured_outputs'], name = id } = {}) => ({
  id,
  name,
  architecture: { input_modalities: input, output_modalities: ['text'] },
  supported_parameters: params,
  pricing: { prompt: '0.000002', completion: '0.00001' },
});

const reply = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('OpenRouter: modelli con JSON strutturato, niente batch, immagini e prezzi', () => {
  const list = filterPlanningModels('openrouter', [
    orModel('b/buono', { name: 'B buono' }),
    orModel('a/json-classico', { name: 'A json', params: ['response_format'] }),
    orModel('c/solo-testo', { name: 'C testo', input: ['text'] }),
    orModel('d/senza-json', { params: ['tools'] }),
    orModel('b/buono:batch'),
    null,
  ]);
  assert.deepEqual(list.map(m => m.id), ['a/json-classico', 'b/buono', 'c/solo-testo']);
  assert.equal(list[1].vision, true);
  assert.equal(list[2].vision, false);
  assert.equal(list[1].promptPerM, 2);
  assert.equal(list[1].completionPerM, 10);
  assert.deepEqual(filterPlanningModels('openrouter', undefined), []);
});

test('DeepSeek: elenco dai campi di /models, immagini secondo input_modalities', () => {
  const list = filterPlanningModels('deepseek', [
    { id: 'deepseek-v4-pro', name: 'DeepSeek-V4-Pro', input_modalities: ['text'], output_modalities: ['text'] },
    { id: 'deepseek-flash', name: 'DeepSeek-V4.1-Flash', input_modalities: ['text', 'image'], output_modalities: ['text'] },
  ]);
  // Ordine alfabetico per nome: "DeepSeek-V4-Pro" < "DeepSeek-V4.1-Flash".
  assert.deepEqual(list.map(m => [m.id, m.vision]), [['deepseek-v4-pro', false], ['deepseek-flash', true]]);
  assert.equal(list[0].promptPerM, null);
});

test('listPlanningModels: DeepSeek richiede la chiave e la invia; 401 → chiave non valida', async () => {
  await assert.rejects(listPlanningModels('deepseek', ''), /Inserisci la chiave DeepSeek/);
  let auth;
  const ok = async (_url, opts) => { auth = opts.headers.Authorization; return reply(200, { data: [] })(); };
  assert.deepEqual(await listPlanningModels('deepseek', 'k', ok), []);
  assert.equal(auth, 'Bearer k');
  await assert.rejects(listPlanningModels('deepseek', 'k', reply(401, {})), /chiave non valida/);
  await assert.rejects(listPlanningModels('sconosciuto', 'k'), /sconosciuto/);
});

test('buildPlanRequest: OpenRouter con json_schema, DeepSeek con json_object', () => {
  const args = { model: 'x/y', prompt: 'json', images: [{ data: 'QUJD', mimeType: 'image/png' }], schema: { type: 'object' } };
  const or = buildPlanRequest('openrouter', args);
  assert.deepEqual(or.messages[0].content[1], { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } });
  assert.equal(or.response_format.type, 'json_schema');
  assert.deepEqual(or.response_format.json_schema.schema, { type: 'object' });
  assert.equal(or.provider.require_parameters, true);

  const ds = buildPlanRequest('deepseek', args);
  assert.deepEqual(ds.response_format, { type: 'json_object' });
  assert.equal(ds.max_tokens, 32768);
  assert.equal(ds.provider, undefined);
});

test('planTrip: risposta valida → contenuto, modello effettivo, costo; indirizzo del fornitore', async () => {
  const urls = [];
  const fetchImpl = (body) => async (url, opts) => { urls.push([url, opts.headers.Authorization]); return reply(200, body)(); };
  const base = { apiKey: 'k', model: 'x/y', prompt: 'p', images: [], schema: {} };

  const or = await planTrip({ ...base, providerId: 'openrouter', fetchImpl: fetchImpl({ model: 'x/y-2026', choices: [{ message: { content: '{"a":1}' } }], usage: { cost: 0.0123 } }) });
  assert.deepEqual(or, { content: '{"a":1}', model: 'x/y-2026', cost: 0.0123 });

  const ds = await planTrip({ ...base, providerId: 'deepseek', fetchImpl: fetchImpl({ choices: [{ message: { content: '{"b":2}' } }] }) });
  assert.deepEqual(ds, { content: '{"b":2}', model: 'x/y', cost: null });

  assert.deepEqual(urls, [
    ['https://openrouter.ai/api/v1/chat/completions', 'Bearer k'],
    ['https://api.deepseek.com/chat/completions', 'Bearer k'],
  ]);
});

test('planTrip: errori del fornitore, risposta vuota, configurazione mancante', async () => {
  const base = { providerId: 'openrouter', apiKey: 'k', model: 'x/y', prompt: 'p', images: [], schema: {} };
  await assert.rejects(planTrip({ ...base, fetchImpl: reply(402, { error: { message: 'Insufficient credits' } }) }), /OpenRouter: Insufficient credits/);
  await assert.rejects(planTrip({ ...base, providerId: 'deepseek', fetchImpl: reply(200, { choices: [{ message: { content: '' } }] }) }), /DeepSeek: .*risposta vuota/);
  await assert.rejects(planTrip({ ...base, apiKey: '' }), /Chiave OpenRouter non configurata/);
  await assert.rejects(planTrip({ ...base, model: '' }), /Modello OpenRouter non scelto/);
});

test('planTrip: oltre il tempo massimo la richiesta viene annullata', async () => {
  const hanging = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  });
  await assert.rejects(
    planTrip({ providerId: 'deepseek', apiKey: 'k', model: 'x', prompt: 'p', images: [], schema: {}, fetchImpl: hanging, timeoutMs: 50 }),
    /DeepSeek non ha risposto entro/
  );
});
