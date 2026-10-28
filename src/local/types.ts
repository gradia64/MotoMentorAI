// Contratto dell'API di persistenza locale esposta dal preload Electron
// come window.motomentorDB, piu' il client tipizzato che usano gli store.

import type { SharedTrip } from '../../types';

export type { SharedTrip };

export interface LocalSession {
  uid: string;
  username: string;
}

// --- Pianificazione viaggi con un fornitore a pagamento (OpenRouter, DeepSeek) ---
export type PlanningProvider = 'openrouter' | 'deepseek';

export interface PlanningStatus {
  provider: PlanningProvider | null;  // null: i viaggi usano Gemini
  model: string | null;
  modelName: string | null;
  vision: boolean;                    // il modello scelto legge le immagini
  keys: Record<PlanningProvider, boolean>;
}

export interface PlanningModel {
  id: string;
  name: string;
  vision: boolean;
  promptPerM: number | null;      // dollari per milione di token in ingresso
  completionPerM: number | null;  // dollari per milione di token in uscita
}

export interface PlanTripRequest {
  prompt: string;
  images: { data: string; mimeType: string }[];
  schema: unknown;
}

export interface PlanTripResult {
  content: string;
  model: string;
  cost: number | null;       // dollari
  costEstimated: boolean;    // true se stimato dal listino (DeepSeek)
  tokens: number | null;     // token totali (ingresso + uscita)
}

export interface LocalDBBridge {
  open(): Promise<boolean>;
  signalReady(): void;
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

  // --- Pianificazione viaggi: le chiavi restano nel main ---
  planningStatus(): Promise<PlanningStatus>;
  savePlanning(provider: PlanningProvider, key: string, model: PlanningModel): Promise<boolean>;
  disablePlanning(): Promise<boolean>;
  clearPlanningKey(provider: PlanningProvider): Promise<boolean>;
  listPlanningModels(provider: PlanningProvider, key?: string): Promise<PlanningModel[]>;
  planTrip(request: PlanTripRequest): Promise<PlanTripResult>;

  // --- Menu Aiuto → Guida ---
  onOpenHelp(cb: () => void): () => void;
}

declare global {
  interface Window {
    motomentorDB: LocalDBBridge;
    // Mantenuto per compatibilita' con geminiService (fallback window.GEMINI_API_KEY).
    GEMINI_API_KEY?: string;
  }
}

export {};
