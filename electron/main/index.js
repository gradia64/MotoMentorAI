// Processo principale Electron di MotoMentor AI.
// Espone al renderer (via IPC) l'intero layer di persistenza locale + la chiave Gemini
// (secret su file) + la condivisione dei viaggi tramite file .mmt.json.
import { app, BrowserWindow, ipcMain, dialog, Menu, shell, session } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as db from './db.js';

// Il main e' un modulo ES ("type":"module"): __dirname non esiste, si deriva
// da import.meta.url (funziona anche dentro l'asar del pacchetto).
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const isDev = !!process.env.MMAI_DEV;
let mainWindow = null;

// Nome coerente della cartella dati: ~/.config/MotoMentorAI
app.setName('MotoMentorAI');

function getDbPath() {
  const base = app.getPath('userData');
  return join(base, 'motomentor.db');
}

function getGeminiKeyPath() {
  return join(app.getPath('userData'), 'gemini.key');
}

// Legge la chiave Gemini dal file locale (mai nel bundle). Se assente, restituisce ''.
function readGeminiKey() {
  try {
    const p = getGeminiKeyPath();
    if (existsSync(p)) return readFileSync(p, 'utf8').trim();
  } catch (e) { /* ignore */ }
  return '';
}

function saveGeminiKey(key) {
  // Senza try/catch: se la scrittura fallisce l'errore arriva al renderer
  // via IPC e la UI mostra il fallimento invece di un finto successo.
  const p = getGeminiKeyPath();
  writeFileSync(p, String(key || '').trim(), { mode: 0o600 });
  return true;
}

function broadcastChanged(path) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('db:changed', path);
  }
}

// ---------------------------------------------------------------
// Condivisione viaggi: file .mmt.json al posto del link cloud.
// ---------------------------------------------------------------

function safeFileName(title) {
  return String(title || 'viaggio')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'viaggio';
}

// Legge e valida un file viaggio condiviso. Solleva un errore se non valido.
function readSharedTripFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const obj = JSON.parse(raw);
  const trip = obj && obj.sharedTrip ? obj.sharedTrip : obj;
  if (!trip || !trip.itinerary || !trip.tripTitle) {
    throw new Error('Il file non contiene un viaggio MotoMentor valido.');
  }
  return trip;
}

async function openSharedTripDialog() {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Apri viaggio condiviso',
    properties: ['openFile'],
    filters: [{ name: 'Viaggio MotoMentor', extensions: ['mmt.json', 'json'] }],
  });
  if (canceled || !filePaths || !filePaths[0]) return null;
  return readSharedTripFile(filePaths[0]);
}

// Un viaggio condiviso può arrivare prima che il renderer abbia caricato e
// registrato il listener (es. doppio click su .mmt.json con app chiusa):
// in quel caso va messo in coda e consegnato al segnale 'app:ready'.
let pendingSharedTrip = null;
let rendererReady = false;

function sendSharedTripToRenderer(trip) {
  if (rendererReady && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('shared-trip:open', trip);
  } else {
    pendingSharedTrip = trip;
  }
}

function registerHandlers() {
  ipcMain.handle('db:open', () => {
    db.openDB(getDbPath());
    return true;
  });
  ipcMain.handle('db:close', () => db.closeDB());
  ipcMain.handle('db:session', () => db.getSession());

  ipcMain.handle('db:register', (_e, username, password) => db.registerUser(username, password));
  ipcMain.handle('db:login', (_e, username, password) => db.loginUser(username, password));
  ipcMain.handle('db:logout', () => db.logoutUser());

  ipcMain.handle('db:list', (_e, path) => db.listDocs(path));
  ipcMain.handle('db:upsert', (_e, path, id, data) => {
    db.upsertDoc(path, id, data);
    broadcastChanged(path);
    return true;
  });
  ipcMain.handle('db:delete', (_e, path, id) => {
    db.deleteDoc(path, id);
    broadcastChanged(path);
    return true;
  });

  ipcMain.handle('config:geminiKey', () => readGeminiKey());
  ipcMain.handle('config:setGeminiKey', (_e, key) => { saveGeminiKey(key); return true; });

  // Il renderer segnala di aver registrato i listener (in particolare
  // 'shared-trip:open'): consegna l'eventuale viaggio rimasto in coda.
  ipcMain.on('app:ready', () => {
    rendererReady = true;
    if (pendingSharedTrip) {
      const trip = pendingSharedTrip;
      pendingSharedTrip = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shared-trip:open', trip);
      }
    }
  });

  // I download del renderer (PDF, GPX) chiedono dove salvare invece di
  // finire in silenzio nella cartella Download.
  session.defaultSession.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({ defaultPath: item.getFilename() });
  });

  // Esporta un viaggio condiviso come file .mmt.json (dialog di salvataggio).
  ipcMain.handle('sharedtrip:save', async (_e, sharedTrip) => {
    if (!sharedTrip || !sharedTrip.itinerary || !sharedTrip.tripTitle) {
      throw new Error('Dati viaggio non validi.');
    }
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Esporta viaggio condiviso',
      defaultPath: `${safeFileName(sharedTrip.tripTitle)}.mmt.json`,
      filters: [{ name: 'Viaggio MotoMentor', extensions: ['mmt.json', 'json'] }],
    });
    if (canceled || !filePath) return false;
    writeFileSync(filePath, JSON.stringify({ app: 'MotoMentorAI', version: 1, sharedTrip }, null, 2));
    return true;
  });

  // Apre un viaggio condiviso da file (dialog di apertura).
  ipcMain.handle('sharedtrip:open', async () => openSharedTripDialog());
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const menu = Menu.buildFromTemplate([
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Apri viaggio condiviso…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            try {
              const trip = await openSharedTripDialog();
              if (trip) sendSharedTripToRenderer(trip);
            } catch (e) {
              dialog.showErrorBox('MotoMentor AI', String(e?.message || e));
            }
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'Chiudi' } : { role: 'quit', label: 'Esci' },
      ],
    },
    {
      label: 'Visualizza',
      submenu: [
        { role: 'reload', label: 'Ricarica' },
        { role: 'forceReload', label: 'Ricarica forzata' },
        { role: 'toggleDevTools', label: 'Strumenti sviluppatore' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom normale' },
        { role: 'zoomIn', label: 'Aumenta zoom' },
        { role: 'zoomOut', label: 'Riduci zoom' },
        { type: 'separator' },
        { role: 'fullscreen', label: 'Schermo intero' },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#1f2937',
    title: 'MotoMentor AI',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'));
  }

  // I link esterni (Google Maps) aprono il browser di sistema, non nuove
  // finestre Electron spoglie. Solo https: per prudenza.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Dopo un reload il renderer deve risegnalarsi prima di ricevere eventi.
  mainWindow.webContents.on('did-start-loading', () => {
    rendererReady = false;
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Single instance: un click su una seconda icona/riapertura porta avanti la finestra
// esistente, e se e' stato aperto un file .mmt.json lo mostra subito.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      const p = argv.find(a => /\.(mmt\.json|json)$/i.test(a));
      if (p && existsSync(p)) {
        try {
          sendSharedTripToRenderer(readSharedTripFile(p));
        } catch (e) {
          dialog.showErrorBox('MotoMentor AI', String(e?.message || e));
        }
      }
    }
  });

  app.whenReady().then(() => {
    registerHandlers();
    buildMenu();
    createWindow();

    // File viaggio passato come argomento all'avvio (es. doppio click su .mmt.json).
    const argPath = process.argv.find(a => /\.(mmt\.json|json)$/i.test(a));
    if (argPath && existsSync(argPath)) {
      try {
        sendSharedTripToRenderer(readSharedTripFile(argPath));
      } catch (e) { /* avvio normale */ }
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

// Esportato per test standalone del main (opzionale).
export { readGeminiKey, saveGeminiKey };
