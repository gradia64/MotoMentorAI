// Client di persistenza locale per il renderer.
// Espone le stesse operazioni usate prima con Firestore (subscribe/upsert/remove),
// piu' auth e gestione chiave Gemini. Tutto passa dall'IPC Electron.

import type { LocalDBBridge, LocalSession, SharedTrip } from './types';
import type { SharedTrip as AppSharedTrip } from '../../types';

function bridge(): LocalDBBridge {
  const b = window.motomentorDB;
  if (!b) throw new Error('motomentorDB non disponibile. Avvia l app come app Electron.');
  return b;
}

// Inizializza il DB e carica la chiave Gemini dal secret locale nel window (per geminiService).
export async function initLocalDB(): Promise<void> {
  await bridge().open();
  try {
    const key = await bridge().getGeminiKey();
    if (key) window.GEMINI_API_KEY = key;
  } catch (e) {
    console.warn('Chiave Gemini non caricata (opzionale al avvio):', e);
  }
}

// --- Auth ---
export const getSession = (): Promise<LocalSession | null> => bridge().session();

// Da chiamare dopo aver registrato i listener (onOpenSharedTrip): sblocca la
// consegna di eventi accodati dal main durante il caricamento del renderer.
export const signalRendererReady = (): void => bridge().signalReady();
export const registerLocal = (username: string, password: string) => bridge().register(username, password);
export const loginLocal = (username: string, password: string) => bridge().login(username, password);
export const logoutLocal = (): Promise<boolean> => bridge().logout();

// --- Collection (semantica Firestore) ---
export const subscribeCollection = <T = any>(path: string, cb: (items: T[]) => void): (() => void) =>
  bridge().subscribe<T>(path, cb);

export const upsertDoc = <T = any>(path: string, id: string, data: T): Promise<boolean> =>
  bridge().upsert<T>(path, id, data);

export const removeDoc = (path: string, id: string): Promise<boolean> =>
  bridge().delete(path, id);

export const listCollection = <T = any>(path: string): Promise<T[]> => bridge().list<T>(path);

// --- Gemini ---
export const getGeminiKey = (): Promise<string> => bridge().getGeminiKey();
export const setGeminiKey = (key: string): Promise<boolean> => bridge().setGeminiKey(key);

// --- Condivisione viaggi via file locale ---
export const saveSharedTripFile = (trip: AppSharedTrip): Promise<boolean> =>
  bridge().saveSharedTrip(trip as SharedTrip);

export const openSharedTripFile = (): Promise<AppSharedTrip> =>
  bridge().openSharedTrip() as Promise<AppSharedTrip>;

export const onOpenSharedTrip = (cb: (trip: AppSharedTrip) => void): (() => void) =>
  bridge().onOpenSharedTrip((trip) => cb(trip as AppSharedTrip));
