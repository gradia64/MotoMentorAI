#!/bin/bash
# Verifica che un tag di rilascio sia annotato e firmato da una sottochiave
# di firma dei TAG (scripts/release-keys.sh), cioè dal maintainer. Non basta
# una chiave qualunque: nemmeno la primaria, che resta offline e certifica
# soltanto, deve poter firmare un tag che passi da qui.
#
# La verifica usa un portachiavi temporaneo con la SOLA chiave pubblica del
# repository (packaging/motomentor-release-key.asc): una chiave presente nel
# portachiavi della macchina non conta. Ripreso da Plico.
#
# Uso: scripts/verify-tag.sh v1.0.0
# MOTOMENTOR_REPO, MOTOMENTOR_RELEASE_KEY, MOTOMENTOR_RELEASE_PRIMARY e
# MOTOMENTOR_TAG_SIGNING_SUBKEYS permettono di provarlo su un altro repository
# o un'altra chiave.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAG="${1:?uso: scripts/verify-tag.sh <tag>}"
REPO="${MOTOMENTOR_REPO:-$ROOT}"
PUBKEY="${MOTOMENTOR_RELEASE_KEY:-$ROOT/packaging/motomentor-release-key.asc}"
# shellcheck source=scripts/release-keys.sh
. "$ROOT/scripts/release-keys.sh"

if [ -z "$RELEASE_PRIMARY" ] || [ -z "$TAG_SIGNING_SUBKEYS" ]; then
    echo "impronte della chiave di rilascio non configurate in scripts/release-keys.sh" >&2
    echo "(packaging/README.md, «Configurazione»)" >&2
    exit 1
fi
if [ ! -s "$PUBKEY" ]; then
    echo "chiave pubblica di rilascio mancante: $PUBKEY" >&2
    exit 1
fi
if [ "$(git -C "$REPO" cat-file -t "refs/tags/$TAG" 2>/dev/null)" != "tag" ]; then
    echo "$TAG non è un tag annotato (git tag -s): niente da verificare" >&2
    exit 1
fi

GNUPGHOME="$(mktemp -d)"
export GNUPGHOME
trap 'gpgconf --kill gpg-agent >/dev/null 2>&1 || true; rm -rf "$GNUPGHOME"' EXIT
chmod 700 "$GNUPGHOME"
gpg --batch --quiet --import "$PUBKEY"

# VALIDSIG <impronta di chi ha firmato> ... <impronta della primaria>: si
# controllano entrambe. Una firma revocata o scaduta non produce VALIDSIG.
status="$(git -C "$REPO" -c gpg.format=openpgp verify-tag --raw "$TAG" 2>&1 || true)"
signer="$(printf '%s\n' "$status" | awk -v p="$RELEASE_PRIMARY" '$2 == "VALIDSIG" && $NF == p { print $3 }')"
for allowed in $TAG_SIGNING_SUBKEYS; do
    if [ -n "$signer" ] && [ "$signer" = "$allowed" ]; then
        echo "$TAG: firmato dal maintainer (sottochiave $signer della chiave di rilascio $RELEASE_PRIMARY)"
        exit 0
    fi
done
if [ -n "$signer" ]; then
    echo "il tag $TAG è firmato da $signer, che non è una sottochiave dei tag ($TAG_SIGNING_SUBKEYS)" >&2
else
    echo "il tag $TAG non ha una firma valida della chiave di rilascio $RELEASE_PRIMARY" >&2
    printf '%s\n' "$status" | grep -E '^\[GNUPG:\] (ERRSIG|BADSIG|NO_PUBKEY|VALIDSIG|EXPKEYSIG|REVKEYSIG)' >&2 || true
fi
exit 1
