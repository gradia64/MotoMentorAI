// Test del layer di persistenza (electron/main/db.js), senza Electron:
// node:sqlite e bcryptjs girano con il Node di sistema (≥ 22.5).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as db from '../electron/main/db.js';

const denied = { message: /Accesso negato/ };

beforeEach(() => {
  db.closeDB();
  db.openDB(':memory:');
});

test('sharedTrips: globale in lettura, modificabile solo dal proprietario', async () => {
  const alice = await db.registerUser('alice', 'secret1');
  db.upsertDoc('sharedTrips', 't1', { tripTitle: 'di Alice', ownerId: alice.uid });
  db.upsertDoc('sharedTrips', 't1', { tripTitle: 'di Alice v2', ownerId: alice.uid });
  db.logoutUser();

  await db.registerUser('bob', 'secret2');
  assert.equal(db.listDocs('sharedTrips').length, 1);
  assert.throws(() => db.upsertDoc('sharedTrips', 't1', { tripTitle: 'X' }), denied);
  assert.throws(() => db.deleteDoc('sharedTrips', 't1'), denied);
  assert.equal(db.listDocs('sharedTrips')[0].tripTitle, 'di Alice v2');

  db.logoutUser();
  await db.loginUser('alice', 'secret1');
  db.deleteDoc('sharedTrips', 't1');
  assert.equal(db.listDocs('sharedTrips').length, 0);
});

test('delete di un documento inesistente: nessun errore', async () => {
  await db.registerUser('alice', 'secret1');
  assert.equal(db.deleteDoc('sharedTrips', 'nessuno'), true);
});

test('i path users/{uid}/ sono isolati tra utenti', async () => {
  const alice = await db.registerUser('alice', 'secret1');
  db.upsertDoc(`users/${alice.uid}/vehicles`, 'v1', { id: 'v1', model: 'A' });
  db.logoutUser();

  await db.registerUser('bob', 'secret2');
  assert.throws(() => db.listDocs(`users/${alice.uid}/vehicles`), denied);
  assert.throws(() => db.upsertDoc(`users/${alice.uid}/vehicles`, 'v2', {}), denied);
  assert.throws(() => db.deleteDoc(`users/${alice.uid}/vehicles`, 'v1'), denied);

  db.logoutUser();
  await db.loginUser('alice', 'secret1');
  assert.equal(db.listDocs(`users/${alice.uid}/vehicles`)[0].model, 'A');
});

test('autenticazione: password errata, utente duplicato, sessione assente', async () => {
  await db.registerUser('alice', 'secret1');
  await assert.rejects(db.registerUser('alice', 'altra123'), { message: /già esistente/ });
  await assert.rejects(db.loginUser('alice', 'sbagliata'), { message: /Password errata/ });
  db.logoutUser();
  assert.throws(() => db.listDocs('sharedTrips'), { message: /Sessione non autenticata/ });
});

test('openDB è idempotente sulla stessa path: un reload non chiude la sessione', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mmdb-'));
  try {
    const file = join(dir, 'motomentor.db');
    db.openDB(file);
    await db.registerUser('carla', 'secret3');
    db.openDB(file);
    assert.equal(db.getSession()?.username, 'carla');
    db.openDB(join(dir, 'altro.db'));
    assert.equal(db.getSession(), null);
  } finally {
    db.closeDB();
    rmSync(dir, { recursive: true, force: true });
  }
});
