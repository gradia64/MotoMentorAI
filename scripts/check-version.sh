#!/bin/bash
# Controlla che un tag di rilascio corrisponda alla versione del codice:
# package.json, package-lock.json e una sezione «## [X.Y.Z] — AAAA-MM-GG»
# in CHANGELOG.md (le voci di «Non rilasciato» spostate sotto la versione).
#
# Uso: scripts/check-version.sh vX.Y.Z
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TAG="${1:?uso: scripts/check-version.sh <tag>}"

if ! [[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "tag non valido: $TAG (atteso vX.Y.Z)" >&2
    exit 1
fi
VERSION="${TAG#v}"

errors=0
pkg="$(node -p 'require("./package.json").version')"
lock="$(node -p 'require("./package-lock.json").version')"
if [ "$pkg" != "$VERSION" ]; then
    echo "package.json dice $pkg, il tag $VERSION" >&2; errors=1
fi
if [ "$lock" != "$VERSION" ]; then
    echo "package-lock.json dice $lock, il tag $VERSION (npm version $VERSION --no-git-tag-version)" >&2; errors=1
fi
if ! grep -qE "^## \[$VERSION\] — [0-9]{4}-[0-9]{2}-[0-9]{2}$" CHANGELOG.md; then
    echo "CHANGELOG.md: manca la sezione «## [$VERSION] — AAAA-MM-GG»" >&2; errors=1
fi
[ "$errors" -eq 0 ] || exit 1
echo "versione $VERSION ok"
