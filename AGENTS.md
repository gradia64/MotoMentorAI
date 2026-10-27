# AGENTS.md — MotoMentor AI

_Punto di riferimento per riprendere il lavoro dopo un'interruzione di sessione.
Aggiornato il 2026-10-27._

## Cosa è in corso
Migrazione dell'app da **Firebase (cloud) a desktop Electron con dati 100% locali**,
per poi impacchettarla in `.deb` (e AppImage). L'app è una SPA React 18 + Vite + TS
(pianificazione viaggi, garage, meccanico virtuale, diario, chat) che usava Firestore +
auth Google + Gemini. Ora: **SQLite locale + auth bcrypt locale + Gemini via chiave
segreta sul disco**. Tutte le funzionalità sono state mantenute (la condivisione viaggi
cloud è diventata export/import di file `.mmt.json`).

## Stato attuale (2026-10-27)
- ✅ Migrazione codice completata (5 store, auth, login, settings, Electron main/preload/db).
- ✅ `tsc --noEmit` → 0 errori.
- ✅ `vite build` → `dist/` prodotta, Tailwind compilato, **zero CDN**, offline.
- ✅ Layer persistenza testato: **13/13** test su `electron/main/db.js`
  (node:sqlite + bcrypt, auth, scope enforcement, sharedTrips).
- ✅ `.deb` costruito: `release/motomentor-ai_1.0.0_amd64.deb` (~108 MB), validato con `dpkg-deb`.
- ⏳ **NON committato**: 41 file modificati, ancora sul branch `main` (working tree sporco).
- ⏳ **NON smoke-testata** la GUI (ambiente headless): login + CRUD + chiamata Gemini da verificare a mano.

## Come costruire / verificare (comandi)
```bash
cd /home/gradia/Documenti/MotoMentorAI
npm install                       # dipendenze (esbuild postinstall bloccato da npm: OK, il binario c'è)
npm run lint                      # tsc --noEmit  → typecheck
npm run build                     # vite build   → dist/
npm run electron:dev              # build + avvia Electron in dev (Vite su :5173)
npm run dist:deb                  # electron-builder --linux deb  → release/*.deb
```
Test rapido del layer DB (indipendente da Electron, usa il node del sistema):
```bash
node -e 'import("./electron/main/db.js").then(db=>{db.openDB(":memory:"); /* ... */})'
# oppure script mjs che chiama registerUser/upsertDoc/listDocs (vedi cronologia sessione 2026-10-27)
```

## Architettura (dove stanno le cose)
**Renderer (React, parla solo via IPC):**
- `src/local/client.ts` + `src/local/types.ts` — astrazione di persistenza. Esporta le
  stesse operazioni di prima (`subscribeCollection`, `upsertDoc`, `removeDoc`, `listCollection`,
  auth, gemini key). Usa `window.motomentorDB` (esposto dal preload).
- `src/store/*` — i 5 store (auth, garage, trip, mechanic, chat) usano TUTTI `../local/client`
  (niente più `firebase/firestore`). `useAuthStore` ha `bootstrap()` che fa `initLocalDB()` + `checkAuth()`.
- `src/utils/dataErrors.ts` — sostituisce il vecchio `firestoreErrors.ts`.
- `components/Login.tsx` (username+password, registro/accesso) e `components/SettingsModal.tsx`
  (imposta chiave Gemini). `App.tsx` chiama `bootstrap()` all'avvio e usa Login come gate.

**Main Electron (Node, fa tutto il lavoro pesante):**
- `electron/main/index.js` — finestra, menu, IPC handlers, dialog per shared-trip `.mmt.json`,
  lettura/scrittura chiave Gemini in `~/.config/MotoMentorAI/gemini.key` (mode 0600).
- `electron/main/db.js` — **cuore**: `node:sqlite` (`DatabaseSync`, nativo, zero compilazioni) +
  `bcryptjs` (pure-JS). Schema: tabella `users` + tabella generica `docs(path,id,user_id,data,updated_at)`.
  `docs` specchia Firestore: ogni doc è `(path, id)` con payload JSON. Enforcement: un path
  `users/{uid}/...` è leggibile/writeabile solo dal proprietario; `sharedTrips` è globale.
- `electron/preload/index.js` — `contextBridge` espone `window.motomentorDB` (contextIsolation on,
  nodeIntegration off). `subscribe()` = caricamento iniziale + riascolto su evento `db:changed`.

**Dati a riposo:** `~/.config/MotoMentorAI/motomentor.db` (SQLite) + `media/` per immagini.
**Config build:** `package.json` → `build` field (appId `com.motomentor.ai`, output `release/`,
target deb+AppImage, icona `build/icons`).

## Modello dati (tabelle)
- `users(uid PK, username UNIQUE, password_hash, created_at)`
- `docs(path, id, user_id, data JSON, updated_at)` — PK `(path,id)`, indici su user_id e path.
- Collection logiche (tutti sotto `users/{uid}/`): `vehicles`, `trips`, `diagnoses`,
  `maintenance`, `reminders`, `chats`. Più `sharedTrips` (globale, non scoped).
- Tipi TS in `types.ts` (invariati). Schema Gemini (ITINERARY/MAINTENANCE_TIPS/VEHICLE_SPECS/RECEIPT_SCAN) in `types.ts`.

## Note / gotchie importanti
- **Chiave Gemini mai nel bundle**: `vite.config.ts` NON inietta più la chiave. Viene letta dal
  main via IPC e iniettata su `window.GEMINI_API_KEY` (in `initLocalDB` e in SettingsModal al salvataggio).
- **`node:sqlite`** richiede Node ≥22.5. Il Node di sistema qui è v24; Electron 45 include Node 22.13+. OK.
- **npm blocca gli install-scripts** (esbuild postinstall): il binario `@esbuild/linux-x64` è
  installato come optionalDep, quindi `vite build` funziona lo stesso. Non serve `npm audit fix`.
- **`desktopName` in electron-builder 26.18.0 non è accettato** (schema rifiuta sia in root sia in
  `linux`). Lasciato fuori: compare un warning cosmetico (WM_CLASS/taskbar grouping) ma il `.deb` funziona.
- **Tailwind/jsPDF ora sono npm** (`tailwind.config.js`, `postcss.config.js`, `src/index.css`,
  `src/utils/pdf.ts`): niente più CDN → offline completo.
- **Service Worker / PWA rimossi** (non ha senso su desktop file://). `index.tsx` non lo registra.
- File **vestigiali** da poter cancellare: `firestore.rules` (niente più Firestore). `firebase-applet-config.json`,
  `firebase-blueprint.json`, `src/firebase.ts`, `manifest.json`, `metadata.json`, `vercel.json`,
  `service-worker.js` sono già stati cancellati (staged come `D`).

## Cosa manca / prossimi passi (in ordine)
1. **Smoke-test GUI** del `.deb` installato: crea utente, aggiungi moto, salva un viaggio,
   genera una diagnosi, prova la chat (serve chiave Gemini valida da Settings). Verifica che i
   dati sopravvivano al riavvio (SQLite).
2. **Commit** dei 41 file su branch dedicato (es. `local-desktop`) — NON committato su `main`.
3. **Pulizia**: cancellare `firestore.rules` (vestigiale).
4. **AppImage**: configurato in `package.json` ma non costruito qui (a runtime serve libfuse).
   `npm run dist` builda sia deb sia AppImage.
5. (Opzionale) Fix cosmetico WM_CLASS se il grouping taskbar dà fastidio: workaround diverso da
   `desktopName` (es. `linux.desktopName` via `app-builder` o `WM_CLASS` esplicito) — solo se serve.

## Riferimenti
- Repo: `git@github.com:gradia64/MotoMentorAI.git`, branch corrente `main`.
- Licenza: GPL-3.0 (`LICENSE` presente).
- Ultimo commit reale prima del lavoro: `dabe99d` "Aggiornamento da AI Studio - 2026-08-14".
