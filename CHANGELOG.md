# Changelog

Le modifiche di MotoMentor AI che si notano da fuori, versione per versione.
Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e le
versioni il [Semantic Versioning](https://semver.org/lang/it/).

<!-- Al rilascio: le voci di «Non rilasciato» passano sotto
     «## [X.Y.Z] — AAAA-MM-GG» (scripts/check-version.sh lo controlla). -->

## [Non rilasciato]

## [1.1.0] — 2026-10-28

### Aggiunto

- **Pianificazione dei viaggi con un modello a pagamento**, facoltativa:
  nelle Impostazioni si sceglie **OpenRouter** (Claude, GPT, Gemini Pro e
  molti altri) oppure **DeepSeek**, con la propria chiave. Solo «Crea
  Itinerario» usa il modello scelto; le altre funzioni restano su Gemini
  gratuito. Al termine compare il costo (esatto con OpenRouter, stimato con
  DeepSeek). Se il fornitore non risponde, il viaggio si pianifica con Gemini.
- In fondo a ogni viaggio, nel Road Book PDF e nei viaggi condivisi è indicato
  il **modello IA che lo ha pianificato**.
- Menu **Aiuto** con una **guida in linea** delle funzioni (tasto F1) e la
  finestra *Informazioni*.
- La prima moto aggiunta al garage diventa subito quella **attiva**.
- **Conferma** prima di eliminare viaggi, diagnosi, interventi e promemoria.

### Modificato

- Gemini usa una catena di modelli Flash (3.8 → 3.7 → 3.6): se uno è
  sovraccarico o non risponde entro un tempo massimo si passa al successivo,
  e se sono tutti occupati si riprova dopo qualche secondo.
- Gli errori dell'IA sono spiegati con messaggi leggibili invece del testo
  tecnico del servizio.
- Un errore inatteso mostra una notifica invece di bloccare l'app con la
  schermata di errore.

### Corretto

- «Salva Diagnosi» non crea più una copia a ogni clic.
- Il PDF della checklist include i suggerimenti specifici del viaggio.
- Le notifiche si vedono anche nella schermata di accesso, nei viaggi
  condivisi e sopra la finestra Impostazioni.
- Eliminare il viaggio aperto lo chiude anche nel Planner e nel Diario.
- Una nota del Diario risulta salvata solo se il salvataggio riesce.

### Sicurezza

- La finestra non può più aprire pagine esterne (link o file trascinati) e il
  database risponde solo alle pagine dell'app.
- I file `.mmt.json` oltre 20 MB vengono rifiutati.
- I permessi del browser (posizione, notifiche, microfono) sono negati.
- Il database e i file delle chiavi sono leggibili solo dal proprietario
  (0600), anche se creati in precedenza con permessi più larghi.
- Le chiavi di OpenRouter e DeepSeek restano nel processo principale e non
  arrivano mai all'interfaccia.

## [1.0.0] — 2026-10-27

Prima versione pubblicata.

### Aggiunto

- Applicazione **desktop per Linux** con dati **100% locali**: profili
  protetti da password, garage, viaggi, diagnosi e chat in un database SQLite
  in `~/.config/MotoMentorAI`.
- **Planner** con itinerari generati da Gemini, Road Book PDF e un file GPX per
  ogni tappa.
- **Diario di viaggio**, **meccanico virtuale** (diagnosi, libretto di
  manutenzione, scansione scontrini, promemoria), **garage** con scadenze e
  **chat** con l'IA.
- **Viaggi condivisi** come file `.mmt.json`: si aprono dal menu *File* o con
  un doppio click, perché il pacchetto associa il tipo di file all'app.
- Pacchetti **`.deb`** e **AppImage**.

### Sicurezza

- La chiave Gemini resta sul dispositivo (`gemini.key`, permessi 0600) e non è
  mai inclusa nel pacchetto.
- Un utente non può modificare né cancellare i viaggi condivisi di un altro.

[Non rilasciato]: https://github.com/gradia64/MotoMentorAI/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/gradia64/MotoMentorAI/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/gradia64/MotoMentorAI/releases/tag/v1.0.0
