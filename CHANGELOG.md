# Changelog

Le modifiche di MotoMentor AI che si notano da fuori, versione per versione.
Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e le
versioni il [Semantic Versioning](https://semver.org/lang/it/).

<!-- Al rilascio: le voci di «Non rilasciato» passano sotto
     «## [X.Y.Z] — AAAA-MM-GG» (scripts/check-version.sh lo controlla). -->

## [Non rilasciato]

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
