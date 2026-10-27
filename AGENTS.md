# AGENTS.md — MotoMentor AI

_Punto di riferimento per riprendere il lavoro dopo un'interruzione di sessione.
Aggiornato il 2026-10-27 (dopo la seconda sessione di bug-fix)._

## Stato (2026-10-27 — migrazione completata + bug-fix, tutto su `main`)
Migrazione desktop Electron (dati 100% locali) completata, verificata end-to-end e
smoke-testata. Successiva **sessione di bug-fix completata**: 23 bug corretti
(commit `bc60270`, pushato su `origin/main`) — race all'avvio dei viaggi condivisi,
crash non gestiti, notifiche, GPX invalidi, scope `sharedTrips`, link esterni,
fallback AI, date locali, ecc. (dettagli nel messaggio del commit).

**Seconda analisi (2026-10-27)**: corretti 11 problemi di gravità alta/media
(commit `2594ff5`, pushato su `origin/main`):
- store svuotati al cambio utente (reset in `App.tsx`), veicolo attivo salvato in
  localStorage **per utente** (`motomentor_active_vehicle_{uid}`);
- interventi/promemoria con `vehicleId` (i record vecchi senza campo restano visibili
  per ogni veicolo); il libretto PDF include solo il veicolo attivo;
- `.mmt.json` e import storico normalizzati da `src/utils/itinerary.ts`;
  il main verifica che `dailySchedule` sia un array;
- `.deb` con `fileAssociations` (MIME `application/x-motomentor-trip`, glob `*.mmt.json`);
  il main accetta il file sia come percorso sia come URI `file://` (`%U`);
- `db.js`: upsert/delete di documenti altrui → errore "Accesso negato";
  `openDB` idempotente sulla stessa path (un reload non fa più logout);
- `client.ts` toglie il prefisso "Error invoking remote method…" dagli errori IPC;
- chat: dopo il fallback diretto la sessione viene ricreata dallo storico;
- `shareTrip` scrive in `sharedTrips` solo dopo il salvataggio del file;
  `SharedTripView` via `id` ora mostra il viaggio.
Problemi a bassa priorità ancora aperti: date UTC in `MaintenanceLog`/scanner,
chiave Gemini non riapplicata alla
chat aperta, nessun limite di dimensione per immagini diagnosi/scontrino, note del
diario perse cambiando viaggio, input immagini mappa non resettato, diagnosi orfane
dopo l'eliminazione di un veicolo.
Scelta voluta (non è un bug): l'export GPX del viaggio condiviso salva un file
per tappa, con un dialog ciascuno, per avere una traccia per ogni giorno di viaggio.

Verifiche correnti:
- ✅ `tsc --noEmit` → 0 errori; `vite build` OK.
- ✅ Test funzionali su `electron/main/db.js`: 14/14 (scope globale `sharedTrips`,
  upsert/delete altrui rifiutati, isolamento path tra utenti, open idempotente).
- ✅ Test della normalizzazione itinerari (`src/utils/itinerary.ts`): 8/8.
- ✅ `.deb` ricostruito **dopo** le correzioni: `release/motomentor-ai_1.0.0_amd64.deb`.

## Come costruire / verificare (comandi)
```bash
cd /home/gradia/Progetti/MotoMentorAI
npm install                       # dipendenze (esbuild postinstall bloccato da npm: OK, il binario c'è)
npm run lint                      # tsc --noEmit  → typecheck
npm run build                     # vite build   → dist/
npm run electron:dev              # build + avvia Electron in dev (Vite su :5173)
npm run dist:deb                  # build + electron-builder --linux deb  → release/*.deb
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
  Dopo aver registrato `onOpenSharedTrip`, il renderer chiama `signalRendererReady()`.
- `src/store/*` — i 5 store (auth, garage, trip, mechanic, chat) usano TUTTI `../local/client`
  (niente più `firebase/firestore`). `useAuthStore` ha `bootstrap()` che fa `initLocalDB()` + `checkAuth()`.
- `src/utils/dataErrors.ts` — sostituisce il vecchio `firestoreErrors.ts`.
- `src/utils/hooks.ts` — `useEscapeKey` + `parseLocalDate` (date 'YYYY-MM-DD' come locali,
  mai `new Date(str)` che usa la mezzanotte UTC).
- `components/Login.tsx` (username+password, validazione client min 3/6) e
  `components/SettingsModal.tsx` (imposta chiave Gemini). `App.tsx` chiama `bootstrap()`
  all'avvio e usa Login come gate; le `unhandledrejection` mostrano una notifica
  (non la schermata fatale).

**Main Electron (Node, fa tutto il lavoro pesante):**
- `electron/main/index.js` — finestra, menu, IPC handlers, dialog per shared-trip `.mmt.json`,
  lettura/scrittura chiave Gemini in `~/.config/MotoMentorAI/gemini.key` (mode 0600).
  Comportamenti introdotti col bug-fix: `setWindowOpenHandler` (link https → browser di
  sistema), `will-download` (dialog di salvataggio per PDF/GPX), handshake `app:ready`
  (il viaggio condiviso da argv/seconda istanza viene accodato finché il renderer non
  segnala di aver registrato i listener), `saveGeminiKey` propaga gli errori.
- `electron/main/db.js` — **cuore**: `node:sqlite` (`DatabaseSync`, nativo, zero compilazioni) +
  `bcryptjs` (pure-JS). Schema: tabella `users` + tabella generica `docs(path,id,user_id,data,updated_at)`.
  `docs` specchia Firestore: ogni doc è `(path, id)` con payload JSON. Enforcement: un path
  `users/{uid}/...` è leggibile/scrivibile solo dal proprietario; `sharedTrips` è globale
  in lettura (senza filtro user_id), l'upsert in conflitto NON ruba la proprietà e la
  delete è riservata al proprietario.
- `electron/preload/index.js` — `contextBridge` espone `window.motomentorDB` (contextIsolation on,
  nodeIntegration off). `subscribe()` = caricamento iniziale + riascolto su evento `db:changed`.
  Espone anche `signalReady()`.

**Dati a riposo:** `~/.config/MotoMentorAI/motomentor.db` (SQLite) + `media/` per immagini.
**Config build:** `package.json` → `build` field (appId `com.motomentor.ai`, output `release/`,
target deb+AppImage, icona `build/icons`).

## Modello dati (tabelle)
- `users(uid PK, username UNIQUE, password_hash, created_at)`
- `docs(path, id, user_id, data JSON, updated_at)` — PK `(path,id)`, indici su user_id e path.
- Collection logiche (tutti sotto `users/{uid}/`): `vehicles`, `trips`, `diagnoses`,
  `maintenance`, `reminders`, `chats`. Più `sharedTrips` (globale, non scoped).
- Le collection sono ordinate per `updated_at` **ASC**: il "più recente" è l'ULTIMO elemento.
- Tipi TS in `types.ts` (invariati). Schema Gemini (ITINERARY/MAINTENANCE_TIPS/VEHICLE_SPECS/RECEIPT_SCAN) in `types.ts`.

## Note / gotchie importanti
- **Chiave Gemini mai nel bundle**: `vite.config.ts` NON inietta più la chiave. Viene letta dal
  main via IPC e iniettata su `window.GEMINI_API_KEY` (in `initLocalDB` e in SettingsModal al salvataggio).
- **Fallback AI filtrato**: il passaggio a `FALLBACK_MODEL` (e il fallback "direct" della chat)
  avviene solo per errori transitori/404 (`isTransientGeminiError` in `geminiService.ts`);
  con chiave non valida si fallisce subito con un solo messaggio.
- **`node:sqlite`** richiede Node ≥22.5. Il Node di sistema qui è v24; Electron 45 include Node 22.13+. OK.
- **npm blocca gli install-scripts** (esbuild postinstall): il binario `@esbuild/linux-x64` è
  installato come optionalDep, quindi `vite build` funziona lo stesso. Non serve `npm audit fix`.
- **`desktopName` in electron-builder 26.18.0 non è accettato** (schema rifiuta sia in root sia in
  `linux`). Lasciato fuori: compare un warning cosmetico (WM_CLASS/taskbar grouping) ma il `.deb` funziona.
- **Tailwind/jsPDF ora sono npm** (`tailwind.config.js`, `postcss.config.js`, `src/index.css`,
  `src/utils/pdf.ts`): niente più CDN → offline completo.
- **Service Worker / PWA rimossi** (non ha senso su desktop file://). `index.tsx` non lo registra.
- **PDF e font**: jsPDF usa font standard WinAnsi: gli accenti italiani passano, ma emoji o
  caratteri fuori WinAnsi nell'output IA escono corrotti (miglioria futura: font Unicode embedded).
- File vestigiali già rimossi: `firestore.rules` (commit `ba9146f`), `firebase-applet-config.json`,
  `firebase-blueprint.json`, `src/firebase.ts`, `manifest.json`, `metadata.json`, `vercel.json`,
  `service-worker.js`.
- Debito tecnico noto e accettato: routing legacy `/shared/` in `App.tsx` (morto su desktop,
  tenuto per dev/web) e collection locale `sharedTrips` poco usata (l'unico lettore è il
  routing legacy; si può eliminare tenendo solo lo scambio via file `.mmt.json`).

## Cosa manca / prossimi passi (in ordine)
1. **Smoke-test GUI dei flussi corretti**: doppio click su `.mmt.json` con app chiusa
   (handshake `app:ready`), funzione IA con chiave reale (fallback filtrato), export
   PDF/GPX (ora col dialog di salvataggio).
2. (Opzionale) **AppImage**: configurata ma non costruita (a runtime serve libfuse).
   `npm run dist` builda sia deb sia AppImage.
3. (Opzionale) Fix cosmetico WM_CLASS se il grouping taskbar dà fastidio.
4. (Opzionale) Font Unicode nei PDF (vedi nota sopra).
5. (Opzionale) Pulizia: rimuovere routing legacy `/shared/` e/o collection `sharedTrips` locale.

## Riferimenti
- Repo: `git@github.com:gradia64/MotoMentorAI.git` (origin), branch corrente `main`.
- Licenza: GPL-3.0 (`LICENSE` presente).
- Ultimo commit: `bc60270` "fix: correzione di 23 bug rilevati dall'analisi del codice".
- Storia: migrazione su `local-desktop` (`d933d31` + follow-up) poi confluita in `main`;
  pulizia `firestore.rules` in `ba9146f`; bug-fix in `bc60270` (pushato).
