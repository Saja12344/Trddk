#!/usr/bin/env bash
# Print Android SHA-1 + package names for Google Maps API key setup.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEYSTORE="${HOME}/.android/debug.keystore"

find_keytool() {
  if command -v keytool >/dev/null 2>&1 && keytool -help >/dev/null 2>&1; then
    command -v keytool
    return
  fi
  local studio="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool"
  if [[ -x "$studio" ]]; then
    echo "$studio"
    return
  fi
  echo ""
}

KEYTOOL="$(find_keytool)"
if [[ -z "$KEYTOOL" || ! -f "$KEYSTORE" ]]; then
  echo "Could not read debug keystore. Open Android Studio → Gradle → signingReport."
  exit 1
fi

echo "=== Google Maps — Android authorization setup ==="
echo ""
echo "Active keys (project trddk-54c45):"
echo "  Android: AIzaSyAmVXpB4849FWhnK96ea2bg3Q-tO8aOdok  (TRDDK Maps Mobile)"
echo "  iOS:     AIzaSyBnTHR_m_rEV0SNhx0qL9L5YdjzPQ0JpZI  (TRDDK Maps iOS)"
echo ""
echo "If maps are blank, verify restrictions in Google Cloud Console."
