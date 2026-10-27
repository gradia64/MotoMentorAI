#!/bin/bash
# Collaudo statico dei pacchetti costruiti da electron-builder (release/):
# per il .deb e per l'AppImage controlla nome e versione, che l'archivio
# dell'app contenga renderer, main e preload, e che la voce desktop
# dichiari il tipo dei viaggi condivisi (.mmt.json), con la definizione
# MIME che li associa all'app.
#
# Non avvia l'app: su Ubuntu 24.04 la sandbox di Chromium dipende dai
# namespace utente, che AppArmor limita, e una prova d'avvio in CI direbbe
# poco. L'avvio va provato a mano prima del tag (packaging/README.md).
#
# Uso: scripts/check-packages.sh [cartella]    (default release/)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# assoluto: più sotto si estrae l'AppImage da una cartella temporanea
DIR="$(realpath -m "${1:-$ROOT/release}")"
# node -e risolve @electron/asar dalla cartella corrente
cd "$ROOT"
VERSION="$(node -p "require('$ROOT/package.json').version")"
NAME="$(node -p "require('$ROOT/package.json').name")"
MIME="application/x-motomentor-trip"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
errors=0
fail() { echo "ERRORE: $*" >&2; errors=1; }

# Controlli comuni su un albero estratto: $1 = cartella dell'app,
# $2 = voce desktop, $3 = nome del pacchetto nei messaggi
check_tree() {
    local appdir="$1" desktop="$2" what="$3"
    [ -x "$appdir/$NAME" ] || fail "$what: eseguibile $NAME mancante in $appdir"
    local asar="$appdir/resources/app.asar"
    if [ -f "$asar" ]; then
        local files
        files="$(node -e "require('@electron/asar').listPackage(process.argv[1]).forEach(f => console.log(f))" "$asar")"
        for f in /dist/index.html /electron/main/index.js /electron/main/db.js /electron/preload/index.js /package.json; do
            grep -qxF "$f" <<<"$files" || fail "$what: $f mancante in app.asar"
        done
        if grep -qE '^/(tests|src|scripts|release)/' <<<"$files"; then
            fail "$what: app.asar contiene file di sviluppo (tests/, src/, scripts/ o release/)"
        fi
    else
        fail "$what: app.asar mancante"
    fi
    if [ -f "$desktop" ]; then
        grep -q "^MimeType=.*$MIME" "$desktop" || fail "$what: MimeType $MIME mancante in $(basename "$desktop")"
        grep -qE '^Exec=.*%[UF]' "$desktop" || fail "$what: Exec senza %U/%F (i file non arriverebbero all'app)"
    else
        fail "$what: voce desktop mancante"
    fi
}

# --- .deb ---
deb="$DIR/${NAME}_${VERSION}_amd64.deb"
if [ -f "$deb" ]; then
    [ "$(dpkg-deb -f "$deb" Version)" = "$VERSION" ] || fail ".deb: versione $(dpkg-deb -f "$deb" Version), attesa $VERSION"
    dpkg-deb -x "$deb" "$WORK/deb"
    appdir="$(dirname "$(find "$WORK/deb/opt" -maxdepth 2 -name "$NAME" -type f | head -1)")"
    check_tree "$appdir" "$(find "$WORK/deb/usr/share/applications" -name '*.desktop' | head -1)" ".deb"
    mimexml="$(find "$WORK/deb/usr/share/mime/packages" -name '*.xml' 2>/dev/null | head -1)"
    if [ -z "$mimexml" ] || ! grep -q "type=\"$MIME\"" "$mimexml" || ! grep -q 'pattern="\*\.mmt\.json"' "$mimexml"; then
        fail ".deb: definizione MIME di $MIME (glob *.mmt.json) mancante"
    fi
    echo ".deb: $(basename "$deb") controllato"
else
    fail ".deb mancante: $deb"
fi

# --- AppImage ---
appimage="$DIR/${NAME}-${VERSION}-x86_64.AppImage"
if [ -f "$appimage" ]; then
    chmod +x "$appimage"
    # --appimage-extract non richiede FUSE
    (cd "$WORK" && "$appimage" --appimage-extract >/dev/null)
    root="$WORK/squashfs-root"
    check_tree "$root" "$(find "$root" -maxdepth 1 -name '*.desktop' | head -1)" "AppImage"
    echo "AppImage: $(basename "$appimage") controllata"
else
    fail "AppImage mancante: $appimage"
fi

[ "$errors" -eq 0 ] || exit 1
echo "pacchetti $VERSION ok"
