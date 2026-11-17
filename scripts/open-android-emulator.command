#!/bin/bash
# Double-click this file (or: open scripts/open-android-emulator.command)
# Opens the emulator in its own Terminal window — stays alive after Cursor closes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_AVD="${ANDROID_AVD:-Tardadi_Passenger}"
EMULATOR_LOG="${EMULATOR_LOG:-/tmp/tardadi-emulator.log}"

if [[ -d "$HOME/Library/Android/sdk" ]]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
elif [[ -d "/opt/homebrew/share/android-commandlinetools" ]]; then
  export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
fi

export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"

if ! command -v emulator >/dev/null 2>&1; then
  echo "Android emulator not found. Install Android Studio first."
  read -r -p "Press Enter to close..."
  exit 1
fi

if adb devices 2>/dev/null | grep -qE '^emulator-[0-9]+[[:space:]]+device'; then
  echo "Emulator already running:"
  adb devices
  read -r -p "Press Enter to close this window (emulator keeps running)..."
  exit 0
fi

echo "Starting $ANDROID_AVD — keep this Terminal window open."
echo "Log: $EMULATOR_LOG"
echo ""

# auto GPU is most stable on Apple Silicon; no snapshots avoids corrupt state.
exec emulator \
  -avd "$ANDROID_AVD" \
  -gpu auto \
  -no-snapshot \
  -no-boot-anim \
  2>&1 | tee -a "$EMULATOR_LOG"
