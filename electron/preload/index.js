// Preload: espone al renderer un'API DB tipizzata e minimale tramite contextBridge.
// Il renderer NON ha accesso diretto a node/Electron: tutto passa dall'IPC del main.
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // --- Sessione / auth ---
  open: () => ipcRenderer.invoke('db:open'),
  close: () => ipcRenderer.invoke('db:close'),
  session: () => ipcRenderer.invoke('db:session'),
  register: (username, password) => ipcRenderer.invoke('db:register', username, password),
  login: (username, password) => ipcRenderer.invoke('db:login', username, password),
  logout: () => ipcRenderer.invoke('db:logout'),

  // --- Collection (semantica Firestore: list / upsert / delete) ---
  list: (path) => ipcRenderer.invoke('db:list', path),
  upsert: (path, id, data) => ipcRenderer.invoke('db:upsert', path, id, data),
  delete: (path, id) => ipcRenderer.invoke('db:delete', path, id),

  // --- Subscribe: come onSnapshot. Emette i dati iniziali e si ripubblica
  //     su 'db:changed' quando il path interessato viene modificato. ---
  subscribe(path, cb) {
    const handler = (_event, changedPath) => {
      if (changedPath !== path) return;
      ipcRenderer.invoke('db:list', path)
        .then((items) => cb(items))
        .catch((err) => console.error('subscribe list error', err));
    };
    ipcRenderer.on('db:changed', handler);
    // Caricamento iniziale.
    ipcRenderer.invoke('db:list', path)
      .then((items) => cb(items))
      .catch((err) => console.error('subscribe initial error', err));
    // Restituisce la funzione di unsubscribe (come onSnapshot).
    return () => ipcRenderer.removeListener('db:changed', handler);
  },

  // --- Gemini key (secret locale, mai nel bundle) ---
  getGeminiKey: () => ipcRenderer.invoke('config:geminiKey'),
  setGeminiKey: (key) => ipcRenderer.invoke('config:setGeminiKey', key),

  // --- Condivisione viaggi via file (.mmt.json) ---
  saveSharedTrip: (trip) => ipcRenderer.invoke('sharedtrip:save', trip),
  openSharedTrip: () => ipcRenderer.invoke('sharedtrip:open'),
  onOpenSharedTrip(cb) {
    const handler = (_event, trip) => cb(trip);
    ipcRenderer.on('shared-trip:open', handler);
    return () => ipcRenderer.removeListener('shared-trip:open', handler);
  },
};

contextBridge.exposeInMainWorld('motomentorDB', api);
