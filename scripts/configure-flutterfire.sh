#!/usr/bin/env bash
# Registers Flutter apps with Firebase project trddk-54c45 via FlutterFire CLI.
# Prerequisites:
#   1. firebase login
#   2. dart pub global activate flutterfire_cli
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$ROOT/node_modules/.bin:$PATH:${HOME}/.pub-cache/bin"

if ! firebase projects:list >/dev/null 2>&1; then
  echo "Run 'firebase login' first, then re-run this script."
  exit 1
fi

echo "==> Passenger (com.tardadi.tardadiPassenger / com.tardadi.tardadi_passenger)"
cd "$ROOT/apps/passenger"
flutterfire configure \
  --project=trddk-54c45 \
  --yes \
  --platforms=ios,android \
  --ios-bundle-id=com.tardadi.tardadiPassenger \
  --android-package-name=com.tardadi.tardadi_passenger \
  --out=lib/firebase_options.dart

echo "==> Driver (com.tardadi.tardadiDriver / com.tardadi.tardadi_driver)"
cd "$ROOT/apps/driver"
flutterfire configure \
  --project=trddk-54c45 \
  --yes \
  --platforms=ios,android \
  --ios-bundle-id=com.tardadi.tardadiDriver \
  --android-package-name=com.tardadi.tardadi_driver \
  --out=lib/firebase_options.dart

echo "Done. Commit firebase_options.dart and platform config files locally (gitignored by default)."
