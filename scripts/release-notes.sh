#!/bin/bash
# Stampa le note di rilascio di una versione: packaging/release-notes/<X.Y.Z>.md.
#
# Sono la descrizione della release GitHub (release.yml, --notes-file): si
# scrivono e si rileggono PRIMA del tag, con sezioni «## …» e il link «Full
# Changelog» in fondo (per la prima release, il link ai commit del tag).
# Il job verify fallisce se mancano. Ripreso da Plico.
#
# Uso: scripts/release-notes.sh X.Y.Z     (anche vX.Y.Z)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:?uso: scripts/release-notes.sh <versione>}"
VERSION="${VERSION#v}"
NOTES="${MOTOMENTOR_RELEASE_NOTES_DIR:-$ROOT/packaging/release-notes}/$VERSION.md"

if [ ! -s "$NOTES" ]; then
    echo "note di rilascio mancanti o vuote: $NOTES" >&2
    echo "scrivile prima del tag, con sezioni «## …» e il link «Full Changelog»" >&2
    exit 1
fi
if ! grep -q '^## ' "$NOTES"; then
    echo "$NOTES: nessuna sezione «## …» (sono ancora in bozza?)" >&2
    exit 1
fi
if ! grep -qE "(compare/.*\.\.\.v$VERSION|commits/v$VERSION)" "$NOTES"; then
    echo "$NOTES: manca il link «Full Changelog» (…compare/…...v$VERSION, o commits/v$VERSION per la prima)" >&2
    exit 1
fi
if grep -qi 'BOZZA' "$NOTES"; then
    echo "$NOTES: contiene ancora «BOZZA»: rileggile e togli il segno prima del tag" >&2
    exit 1
fi
cat "$NOTES"
