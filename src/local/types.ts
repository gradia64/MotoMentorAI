// Contratto dell'API di persistenza locale esposta dal preload Electron
// come window.motomentorDB, piu' il client tipizzato che usano gli store.

import type { SharedTrip } from '../../types';

export type { SharedTrip };

export interface LocalSession {
  uid: string;
  username: string;
}

export interface LocalDBBridge {
  open(): Promise<boolean>;
  close(): Promise<boolean>;
  session(): Promise<LocalSession | null>;
  register(username: string, password: string): Promise<LocalSession>;
  login(username: string, password: string): Promise<LocalSession>;
  logout(): Promise<boolean>;

  list<T = any>(path: string): Promise<T[]>;
  upsert<T = any>(path: string, id: string, data: T): Promise<boolean>;
  delete(path: string, id: string): Promise<boolean>;
  subscribe<T = any>(path: string, cb: (items: T[]) => void): () => void;

  getGeminiKey(): Promise<string>;
  setGeminiKey(key: string): Promise<boolean>;

  // --- Condivisione viaggi via file locale (sostituisce il link cloud) ---
  saveSharedTrip(trip: SharedTrip): Promise<boolean>;
  openSharedTrip(): Promise<SharedTrip>;
  onOpenSharedTrip(cb: (trip: SharedTrip) => void): () => void;
}

declare global {
  interface Window {
    motomentorDB: LocalDBBridge;
    // Mantenuto per compatibilita' con geminiService (fallback window.GEMINI_API_KEY).
    GEMINI_API_KEY?: string;
  }
}

export {};
