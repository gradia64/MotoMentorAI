// Layer di persistenza locale di MotoMentor AI.
// Usa node:sqlite (nativo, zero compilazioni) + bcryptjs (pure-JS) per l'auth.
// Modello generico "docs" che specchia Firestore: ogni documento è identificato
// da un path (es. "users/{uid}/vehicles") + id, con un JSON come payload.
// In questo modo i store del renderer mantengono la stessa semantica di prima.

import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db = null;
let currentUid = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  uid             TEXT PRIMARY KEY,
  username        TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS docs (
  path        TEXT NOT NULL,
  id          TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  data        TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (path, id)
);

CREATE INDEX IF NOT EXISTS idx_docs_user ON docs(user_id);
CREATE INDEX IF NOT EXISTS idx_docs_path ON docs(path);
`;

function getDb() {
  if (!db) throw new Error('DB non inizializzato. Chiama openDB() prima.');
  return db;
}

// Apre (o crea) il database alla path data. Se data è ':memory:' usa un DB volatile.
export function openDB(dataPath) {
  db = new DatabaseSync(dataPath);
  db.exec(SCHEMA);
  currentUid = null;
  return true;
}

export function closeDB() {
  if (db) { db.close(); db = null; currentUid = null; }
  return true;
}

export function getSession() {
  if (!currentUid) return null;
  const row = getDb().prepare('SELECT uid, username FROM users WHERE uid = ?').get(currentUid);
  return row ? { uid: row.uid, username: row.username } : null;
}

export function currentUser() {
  return getSession();
}

// --- Auth ---

export async function registerUser(username, password) {
  username = String(username || '').trim();
  if (!username || username.length < 3) throw new Error('Nome utente: almeno 3 caratteri.');
  if (!password || password.length < 6) throw new Error('Password: almeno 6 caratteri.');
  const hash = await bcrypt.hash(password, 10);
  const uid = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    getDb().prepare(
      'INSERT INTO users (uid, username, password_hash, created_at) VALUES (?, ?, ?, ?)'
    ).run(uid, username, hash, now);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error('Nome utente già esistente.');
    throw e;
  }
  currentUid = uid;
  return { uid, username };
}

export async function loginUser(username, password) {
  username = String(username || '').trim();
  const row = getDb().prepare('SELECT uid, username, password_hash FROM users WHERE username = ?').get(username);
  if (!row) throw new Error('Utente non trovato.');
  const ok = await bcrypt.compare(password || '', row.password_hash);
  if (!ok) throw new Error('Password errata.');
  currentUid = row.uid;
  return { uid: row.uid, username: row.username };
}

export function logoutUser() {
  currentUid = null;
  return true;
}

// --- Collection generiche (mappano esattamente Firestore) ---

function requireAuth() {
  if (!currentUid) throw new Error('Sessione non autenticata.');
  return currentUid;
}

// Difesa a difesa: i path scoped all'utente devono appartenere all'uid di sessione.
// Le collection di livello globale (es. sharedTrips) sono l'eccezione.
function assertPathOwner(uid, path) {
  if (path === 'sharedTrips' || path.startsWith('sharedTrips/')) return;
  const prefix = `users/${uid}/`;
  if (!path.startsWith(prefix)) {
    throw new Error('Accesso negato: documento fuori dal tuo spazio utente.');
  }
}

// Lista tutti i documenti di un path (es. "users/{uid}/vehicles").
export function listDocs(path) {
  const uid = requireAuth();
  assertPathOwner(uid, path);
  const rows = getDb()
    .prepare('SELECT data FROM docs WHERE path = ? AND user_id = ? ORDER BY updated_at ASC')
    .all(path, uid);
  return rows.map((r) => JSON.parse(r.data));
}

// Subscribe: stessa semantica di onSnapshot. Qui è implementata come caricamento
// iniziale; il main process invia un evento 'db:changed' su ogni write e il client
// si limita a ricaricare. Restituisce una funzione di unsubscribe (niente stato
// attivo lato main, un solo renderer).
export function listDocsOnce(path) {
  return listDocs(path);
}

// Upsert (setDoc con merge = sovrascrive l'intero documento, come setDoc default).
export function upsertDoc(path, id, data) {
  const uid = requireAuth();
  assertPathOwner(uid, path);
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO docs (path, id, user_id, data, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(path, id) DO UPDATE SET user_id = excluded.user_id, data = excluded.data, updated_at = excluded.updated_at`
    )
    .run(path, id, uid, JSON.stringify(data ?? {}), now);
  return true;
}

export function deleteDoc(path, id) {
  const uid = requireAuth();
  assertPathOwner(uid, path);
  getDb().prepare('DELETE FROM docs WHERE path = ? AND id = ? AND user_id = ?').run(path, id, uid);
  return true;
}

// Utility di test: reset completo (solo in-memory / sviluppo).
export function __reset() {
  closeDB();
}
