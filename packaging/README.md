# Rilascio di MotoMentor AI

Procedura ripresa da Plico (e da lì da OllaDesk): un **tag firmato** dal
maintainer avvia `.github/workflows/release.yml`, che verifica firma e
versione, costruisce e collauda `.deb` e AppImage e li allega alla release
GitHub con `SHA256SUMS` e un'**attestazione di provenienza**. La CI non firma
niente e non custodisce segreti.

## Cosa fa la CI

| Job | Cosa fa |
|---|---|
| `verify` | tag annotato e firmato dalla sottochiave dei tag (`scripts/verify-tag.sh`), versione uguale in tag, `package.json`, `package-lock.json` e `CHANGELOG.md` (`scripts/check-version.sh`), note presenti e non in bozza (`scripts/release-notes.sh`) |
| `tests` | lo stesso `ci.yml` di ogni push: typecheck, `npm test`, build del renderer |
| `packages` | `electron-builder --linux deb AppImage --publish never`, poi `scripts/check-packages.sh`: versione, contenuto di `app.asar`, voce desktop con `%U` e associazione dei file `.mmt.json`. SHA-256 nel riepilogo del job |
| `publish` | **attende la tua approvazione** (environment `release`), poi: `SHA256SUMS`, attestazione di provenienza, release GitHub con la descrizione da `packaging/release-notes/X.Y.Z.md` |

Avviato a mano (`gh workflow run release.yml --ref main`) esegue `tests` e
`packages`: si scaricano i pacchetti dagli artefatti del run, senza pubblicare.

File allegati alla release:

```
motomentor-ai_X.Y.Z_amd64.deb          pacchetto Debian/Ubuntu
motomentor-ai-X.Y.Z-x86_64.AppImage    AppImage
SHA256SUMS                             checksum dei due file
```

## Configurazione (una volta sola)

### 1. La chiave di rilascio

Come per gli altri progetti, una chiave OpenPGP dedicata: la **primaria**
solo certifica e non lascia la tua macchina; una **sottochiave** firma i tag.
Creata il 2026-10-27: primaria `B9BE9034B84C16D70F8BB0DDB26652F3D81EACE4` (scade il 2031-10-26), sottochiave dei
tag `989392EDD3CC209FC62D73D41B75E7B40108A445` (scade il 2029-10-26).

Nei comandi qui sotto le impronte stanno in variabili di shell: un segnaposto
tra parentesi angolari (`<PRIMARIA>`) bash lo leggerebbe come redirezione da
un file, e il comando fallirebbe.

```bash
PRIMARIA=B9BE9034B84C16D70F8BB0DDB26652F3D81EACE4
SOTTOCHIAVE=989392EDD3CC209FC62D73D41B75E7B40108A445
```

Per ricrearla da zero (gpg chiede una passphrase per la chiave):

```bash
gpg --quick-gen-key "MotoMentor AI release key <gradia@disroot.org>" ed25519 cert 5y
PRIMARIA=$(gpg --with-colons --list-keys "MotoMentor AI release key" | awk -F: '$1=="fpr"{print $10; exit}')
gpg --quick-add-key "$PRIMARIA" ed25519 sign 3y       # sottochiave dei tag
gpg --list-keys --with-subkey-fingerprints "$PRIMARIA" # impronta della sottochiave [S]
```

Poi, nel repository:

1. scrivi le due impronte in `scripts/release-keys.sh` (`RELEASE_PRIMARY` e
   `TAG_SIGNING_SUBKEYS`) e nella sezione «Verifica» del `README.md`;
2. esporta la chiave pubblica:
   `gpg --armor --export "$PRIMARIA" > packaging/motomentor-release-key.asc`;
3. pubblicala, perché chiunque possa verificare i tag:

   ```bash
   gpg --keyserver hkps://keys.openpgp.org --send-keys "$PRIMARIA"
   gpg --keyserver hkps://keyserver.ubuntu.com --send-keys "$PRIMARIA"
   ```

   keys.openpgp.org mostra nome ed email solo dopo la conferma dell'indirizzo:
   `gpg --export "$PRIMARIA" | curl -T - https://keys.openpgp.org` e segui il
   link stampato.

4. commit e push di `scripts/release-keys.sh`, `README.md` e
   `packaging/motomentor-release-key.asc`.

Conserva un backup della primaria fuori dal computer (`gpg --export-secret-keys
--armor "$PRIMARIA"`), e il certificato di revoca che gpg ha creato in
`~/.gnupg/openpgp-revocs.d/`.

### 2. git in questo checkout

```bash
git config gpg.format openpgp
git config user.signingkey "$SOTTOCHIAVE!"   # «!»: proprio questa sottochiave
git config tag.gpgSign true
```

### 3. L'environment «release» su GitHub

*Settings → Environments → New environment* `release`:

- **Required reviewers**: tu. Il job `publish` aspetta la tua approvazione:
  è l'ultimo punto di controllo prima che la release diventi pubblica.
- **Deployment branches and tags** → *Selected branches and tags* → regola sui
  tag `v*`: da nessun altro ramo si può pubblicare.

Nessun secret da aggiungere.

## A ogni rilascio

1. **Prova a mano** l'app costruita (`npm run dist`, poi il `.deb` e
   l'AppImage in `release/`): login e cambio utente, una funzione IA con una
   chiave vera, export PDF e GPX, doppio click su un `.mmt.json` con l'app
   chiusa.
2. **Versione**: `npm version X.Y.Z --no-git-tag-version` (aggiorna
   `package.json` e `package-lock.json`).
3. **CHANGELOG.md**: le voci di «Non rilasciato» passano sotto
   `## [X.Y.Z] — AAAA-MM-GG`.
4. **Note** in `packaging/release-notes/X.Y.Z.md`: sono la descrizione della
   release. Sezioni `## …` e in fondo il link
   `**Full Changelog**: https://github.com/gradia64/MotoMentorAI/compare/vPRECEDENTE...vX.Y.Z`
   (per la prima release, `…/commits/v1.0.0`). Rileggile e togli la riga
   `BOZZA`, se c'è.
5. **Controlli locali**, commit e push:

   ```bash
   npm run lint && npm test
   scripts/check-version.sh vX.Y.Z
   scripts/release-notes.sh X.Y.Z
   git commit -am "Versione X.Y.Z" && git push
   ```

6. **Prova del packaging in CI**, facoltativa: `gh workflow run release.yml --ref main`.
7. **Tag firmato**, verificato, pubblicato: il resto lo fa `release.yml`.

   ```bash
   git tag -s vX.Y.Z -m "MotoMentor AI X.Y.Z"
   scripts/verify-tag.sh vX.Y.Z
   git push origin vX.Y.Z
   ```

8. **Approva** il job `publish` dalla pagina del run, quando `verify`, `tests`
   e `packages` sono verdi.

Se un job fallisce dopo il push del tag: correggi, e poiché il tag pubblicato
non va spostato, rilascia con la patch successiva (vX.Y.Z+1).

## Verificare un pacchetto scaricato

```bash
sha256sum -c SHA256SUMS --ignore-missing
gh attestation verify motomentor-ai_X.Y.Z_amd64.deb -R gradia64/MotoMentorAI
```

E il tag nel repository: `scripts/verify-tag.sh vX.Y.Z`.
