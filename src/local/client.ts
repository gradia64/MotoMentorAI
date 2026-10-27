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

// Electron antepone ai messaggi di errore dell'IPC un prefisso tecnico
// ("Error invoking remote method 'db:login': Error: ..."): lo si rimuove
// perché i messaggi del main sono pensati per essere mostrati all'utente.
const IPC_ERROR_PREFIX = /^Error invoking remote method '[^']*':\s*(?:[A-Za-z]*Error:\s*)?/;

async function call<T>(promise: Promise<T>): Promise<T> {
    try {
        return await promise;
    } catch (e: any) {
        const message = e instanceof Error ? e.message : String(e);
        const cleaned = message.replace(IPC_ERROR_PREFIX, '');
        if (cleaned === message) throw e;
        throw new Error(cleaned);
    }
}

// Inizializza il DB e carica la chiave Gemini dal secret locale nel window (per geminiService).
export async function initLocalDB(): Promise<void> {
  await call(bridge().open());
  try {
    const key = await bridge().getGeminiKey();
    if (key) window.GEMINI_API_KEY = key;
  } catch (e) {
    console.warn('Chiave Gemini non caricata (opzionale al avvio):', e);
  }
}

// --- Auth ---
export const getSession = (): Promise<LocalSession | null> => call(bridge().session());

// Da chiamare dopo aver registrato i listener (onOpenSharedTrip): sblocca la
// consegna di eventi accodati dal main durante il caricamento del renderer.
export const signalRendererReady = (): void => bridge().signalReady();
export const registerLocal = (username: string, password: string) => call(bridge().register(username, password));
export const loginLocal = (username: string, password: string) => call(bridge().login(username, password));
export const logoutLocal = (): Promise<boolean> => call(bridge().logout());

// --- Collection (semantica Firestore) ---
export const subscribeCollection = <T = any>(path: string, cb: (items: T[]) => void): (() => void) =>
  bridge().subscribe<T>(path, cb);

export const upsertDoc = <T = any>(path: string, id: string, data: T): Promise<boolean> =>
  call(bridge().upsert<T>(path, id, data));

export const removeDoc = (path: string, id: string): Promise<boolean> =>
  call(bridge().delete(path, id));

export const listCollection = <T = any>(path: string): Promise<T[]> => call(bridge().list<T>(path));

// --- Gemini ---
export const getGeminiKey = (): Promise<string> => call(bridge().getGeminiKey());
export const setGeminiKey = (key: string): Promise<boolean> => call(bridge().setGeminiKey(key));

// --- Condivisione viaggi via file locale ---
export const saveSharedTripFile = (trip: AppSharedTrip): Promise<boolean> =>
  call(bridge().saveSharedTrip(trip as SharedTrip));

export const openSharedTripFile = (): Promise<AppSharedTrip> =>
  call(bridge().openSharedTrip()) as Promise<AppSharedTrip>;

export const onOpenSharedTrip = (cb: (trip: AppSharedTrip) => void): (() => void) =>
  bridge().onOpenSharedTrip((trip) => cb(trip as AppSharedTrip));
