// Fornitori a pagamento (API compatibili OpenAI) per la sola pianificazione
// dei viaggi: OpenRouter e DeepSeek. Gira solo nel processo main: le chiavi non
// arrivano mai al renderer. Senza dipendenze da Electron: testabile con
// node:test e una fetch finta.

// Un itinerario è un JSON lungo (tappe, tracciati GPS): i modelli grandi
// possono impiegare qualche minuto.
export const PLAN_TIMEOUT_MS = 240_000;
const LIST_TIMEOUT_MS = 20_000;

// Prezzo OpenRouter (dollari per token, stringa) → dollari per milione di token.
const perMillion = (price) => {
  const n = Number(price);
  return Number.isFinite(n) ? Math.round(n * 1e6 * 100) / 100 : null;
};

const byName = (a, b) => a.name.localeCompare(b.name);

// Ogni fornitore descrive: indirizzo, come filtrare l'elenco dei modelli e
// come chiedere l'output JSON.
export const PROVIDERS = {
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    listNeedsKey: false,
    // Modelli che rispondono in testo e supportano l'output JSON strutturato.
    // Le varianti ":batch" sono asincrone e non servono a un'app interattiva.
    filterModels(models) {
      return models
        .filter((m) => {
          if (!m || typeof m.id !== 'string' || m.id.endsWith(':batch')) return false;
          const input = m.architecture?.input_modalities || [];
          const output = m.architecture?.output_modalities || [];
          const params = m.supported_parameters || [];
          return input.includes('text') && output.includes('text')
            && (params.includes('structured_outputs') || params.includes('response_format'));
        })
        .map((m) => ({
          id: m.id,
          name: typeof m.name === 'string' && m.name ? m.name : m.id,
          vision: (m.architecture?.input_modalities || []).includes('image'),
          promptPerM: perMillion(m.pricing?.prompt),
          completionPerM: perMillion(m.pricing?.completion),
        }))
        .sort(byName);
    },
    // strict: false perché lo schema dell'itinerario non dichiara tutti i
    // campi come obbligatori; la risposta viene comunque normalizzata.
    jsonOptions: (schema) => ({
      response_format: { type: 'json_schema', json_schema: { name: 'itinerario', strict: false, schema } },
      // Solo provider che supportano davvero response_format.
      provider: { require_parameters: true },
      usage: { include: true },
    }),
    headers: { 'X-Title': 'MotoMentor AI' },
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    listNeedsKey: true,
    filterModels(models) {
      return models
        .filter((m) => m && typeof m.id === 'string'
          && (!m.output_modalities || m.output_modalities.includes('text')))
        .map((m) => ({
          id: m.id,
          name: typeof m.name === 'string' && m.name ? m.name : m.id,
          vision: (m.input_modalities || []).includes('image'),
          // /models di DeepSeek non riporta i prezzi.
          promptPerM: null,
          completionPerM: null,
        }))
        .sort(byName);
    },
    // DeepSeek accetta solo json_object: lo schema è nel testo della richiesta.
    // max_tokens ampio perché un itinerario lungo non venga troncato.
    jsonOptions: () => ({ response_format: { type: 'json_object' }, max_tokens: 32768 }),
    headers: {},
  },
};

export const isProvider = (id) => Object.prototype.hasOwnProperty.call(PROVIDERS, id);

const getProvider = (id) => {
  if (!isProvider(id)) throw new Error('Fornitore di pianificazione sconosciuto.');
  return PROVIDERS[id];
};

export function filterPlanningModels(providerId, models) {
  return Array.isArray(models) ? getProvider(providerId).filterModels(models) : [];
}

export async function listPlanningModels(providerId, apiKey, fetchImpl = fetch) {
  const provider = getProvider(providerId);
  if (provider.listNeedsKey && !apiKey) throw new Error(`Inserisci la chiave ${provider.label} per vedere i modelli.`);
  const res = await fetchImpl(`${provider.baseUrl}/models`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
  });
  if (res.status === 401) throw new Error(`${provider.label}: chiave non valida.`);
  if (!res.ok) throw new Error(`${provider.label}: elenco modelli non disponibile (HTTP ${res.status}).`);
  const json = await res.json();
  return filterPlanningModels(providerId, json?.data);
}

export function buildPlanRequest(providerId, { model, prompt, images = [], schema }) {
  return {
    model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        ...images.map((img) => ({
          type: 'image_url',
          image_url: { url: `data:${img.mimeType};base64,${img.data}` },
        })),
      ],
    }],
    ...getProvider(providerId).jsonOptions(schema),
  };
}

// Restituisce il testo JSON della risposta, il modello effettivo e il costo
// in dollari, se il fornitore lo riporta (OpenRouter sì, DeepSeek no).
export async function planTrip({ providerId, apiKey, model, prompt, images, schema, fetchImpl = fetch, timeoutMs = PLAN_TIMEOUT_MS }) {
  const provider = getProvider(providerId);
  if (!apiKey) throw new Error(`Chiave ${provider.label} non configurata.`);
  if (!model) throw new Error(`Modello ${provider.label} non scelto.`);
  let res;
  try {
    res = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...provider.headers,
      },
      body: JSON.stringify(buildPlanRequest(providerId, { model, prompt, images, schema })),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      throw new Error(`${provider.label} non ha risposto entro ${Math.round(timeoutMs / 1000)} secondi.`);
    }
    throw new Error(`${provider.label} non raggiungibile: ${e?.message || e}`);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.error) {
    throw new Error(`${provider.label}: ${json?.error?.message || `errore HTTP ${res.status}`}`);
  }
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error(`${provider.label}: il modello ha restituito una risposta vuota.`);
  }
  return {
    content,
    model: typeof json.model === 'string' && json.model ? json.model : model,
    cost: typeof json.usage?.cost === 'number' ? json.usage.cost : null,
  };
}
