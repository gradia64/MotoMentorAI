# MotoMentor AI — Desktop

Assistente personale per motociclisti: **pianificazione viaggi con IA, garage con scadenze, meccanico virtuale, diario di viaggio e chat** — come applicazione desktop con dati **100% locali**.

> Nessun account Google, nessun database cloud: profili utente, garage, viaggi, diagnosi e chat sono salvati in un database **SQLite locale** protetto da password (bcrypt). L'unica funzione che richiede rete è l'IA, e funziona con la **tua** chiave API, salvata solo sul tuo dispositivo. **Google Gemini** (piano gratuito) copre tutte le funzioni IA; per generare gli itinerari puoi usare facoltativamente anche **OpenRouter** o **DeepSeek**.

## Funzionalità

- **Planner** — itinerari giorno per giorno generati dall'IA (Gemini, oppure OpenRouter o DeepSeek se configurati): strade panoramiche, meteo, ristori, alloggi; export **Road Book PDF** e **GPX** per ogni tappa.
- **Diario di viaggio** — note giornaliere e "racconto epico" generato dall'IA, esportabile in PDF.
- **Meccanico virtuale** — diagnosi da descrizione + foto, libretto manutenzione, **scansione scontrini** (IA vision), promemoria interventi.
- **Garage** — mezzi, dati tecnici (via IA), scadenze **assicurazione/bollo/revisione** con alert.
- **Chat IA** — assistente con contesto della tua moto e cronologia salvata.
- **Condivisione viaggi** — esporta un itinerario come file `.mmt.json` riapribile da chiunque abbia l'app (menu *File → Apri viaggio condiviso*, Ctrl+O).

## Requisiti

- Node.js ≥ 22 (per lo sviluppo) — nessun requisito per l'app installata dal pacchetto.
- Una chiave API **Google Gemini** (gratuita su [aistudio.google.com](https://aistudio.google.com) → *Get API key*), necessaria per le funzioni IA.
- Facoltativo: una chiave **OpenRouter** ([openrouter.ai](https://openrouter.ai) → *Keys*) o **DeepSeek** ([platform.deepseek.com](https://platform.deepseek.com) → *API keys*), a pagamento sul tuo account, per generare gli itinerari con il modello che preferisci.

## IA e fornitori

Le chiavi si impostano dalla finestra **Impostazioni** e restano sul tuo dispositivo (permessi `0600`).

| Fornitore | Costo | Copre |
|---|---|---|
| **Google Gemini** | gratuito (piano free) | tutte le funzioni IA |
| **OpenRouter** | a pagamento (tuo account) | solo *Crea Itinerario* |
| **DeepSeek** | a pagamento (tuo account) | solo *Crea Itinerario* |

Se il fornitore scelto per gli itinerari fallisce — o se il modello non legge le immagini e servono gli screenshot — la generazione **ripiega automaticamente su Gemini**, con un avviso. Il modello effettivamente usato resta registrato sotto il viaggio e nel PDF esportato.

## Sviluppo

```bash
npm install
npm run lint          # typecheck (tsc)
npm test              # test del layer SQLite e delle utility del renderer
npm run build         # build del renderer (vite → dist/)
npm run electron:run  # avvia l'app Electron sul build corrente
npm run electron:dev  # build + avvio in modalità dev (devtools aperti)
```

## Pacchettizzazione (Linux)

```bash
npm run dist:deb   # .deb  → release/motomentor-ai_<version>_amd64.deb
npm run dist       # .deb + AppImage
scripts/check-packages.sh   # collaudo statico dei pacchetti in release/
```

## Rilascio

Un tag firmato `vX.Y.Z` avvia `.github/workflows/release.yml`: verifica firma
e versione, costruisce e collauda `.deb` e AppImage e li allega alla release
GitHub con `SHA256SUMS` e un'attestazione di provenienza. Procedura completa,
configurazione della chiave inclusa, in [packaging/README.md](packaging/README.md).

```bash
git tag -s vX.Y.Z -m "MotoMentor AI X.Y.Z"
scripts/verify-tag.sh vX.Y.Z
git push origin vX.Y.Z
```

## Verifica

I tag si firmano con la **chiave di rilascio di MotoMentor AI** (chiave
pubblica in `packaging/motomentor-release-key.asc`):

- primaria: `B9BE 9034 B84C 16D7 0F8B  B0DD B266 52F3 D81E ACE4` (solo certificazione)
- sottochiave dei tag: `9893 92ED D3CC 209F C62D  73D4 1B75 E7B4 0108 A445`

Per un pacchetto scaricato dalla release:

```bash
sha256sum -c SHA256SUMS --ignore-missing
gh attestation verify motomentor-ai_X.Y.Z_amd64.deb -R gradia64/MotoMentorAI
```

## Dove finiscono i miei dati?

| Cosa | Dove |
|---|---|
| Database (profili, garage, viaggi, chat) | `~/.config/MotoMentorAI/motomentor.db` |
| Chiave API Gemini (permessi 0600) | `~/.config/MotoMentorAI/gemini.key` |
| Chiave API OpenRouter (0600, facoltativa) | `~/.config/MotoMentorAI/openrouter.key` |
| Chiave API DeepSeek (0600, facoltativa) | `~/.config/MotoMentorAI/deepseek.key` |
| Impostazioni IA (fornitore e modello scelti) | `~/.config/MotoMentorAI/ai-settings.json` |

Backup = copiare la cartella `~/.config/MotoMentorAI`. Eliminare l'app **non** elimina i tuoi dati.

## Architettura

- **Renderer**: React 18 + Zustand + Tailwind (compilato in build, zero CDN), bundle Vite.
- **Main process Electron**: SQLite (`node:sqlite`, nessuna dipendenza nativa da compilare) + bcryptjs; il renderer accede ai dati solo via `contextBridge`/IPC, con la stessa semantica di Firestore (`subscribe`/`upsert`/`delete`).
- **Auth locale multi-profilo**: username + password (hash bcrypt), ogni documento è legato allo `user_id` di sessione.
- **IA**: le chiamate ai fornitori a pagamento (OpenRouter, DeepSeek) girano **solo nel main process** (`electron/main/planning.js`); le chiavi non entrano mai nel bundle del renderer, che ne vede solo lo stato. Il costo per itinerario viene mostrato — esatto per OpenRouter, stimato dai token per DeepSeek.

## Licenza

GPL-3.0 — vedi [LICENSE](LICENSE).
