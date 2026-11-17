#!/usr/bin/env bash
# Start (or reuse) the Android emulator.
# On macOS, opens a dedicated Terminal window so the emulator survives Cursor exits.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_AVD="${ANDROID_AVD:-Tardadi_Passenger}"
EMULATOR_LOG="${EMULATOR_LOG:-/tmp/tardadi-emulator.log}"

if [[ -z "${ANDROID_HOME:-}" ]]; then
  if [[ -d "$HOME/Library/Android/sdk" ]]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  elif [[ -d "/opt/homebrew/share/android-commandlinetools" ]]; then
    export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
  fi
fi

if [[ -n "${ANDROID_HOME:-}" ]]; then
  export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
fi

if ! command -v emulator >/dev/null 2>&1; then
  echo "Android emulator not found. Install Android Studio / commandlinetools."
  exit 1
fi

if adb devices 2>/dev/null | grep -qE '^emulator-[0-9]+[[:space:]]+device'; then
  DEVICE_ID="$(adb devices | awk '/^emulator-.*device/{print $1; exit}')"
  echo "Emulator already running: $DEVICE_ID"
  exit 0
fi

if adb devices 2>/dev/null | grep -qE '^emulator-[0-9]+[[:space:]]+offline'; then
  echo "Emulator boot in progress, waiting..."
  adb wait-for-device
  exit 0
fi

# macOS: launch in Terminal.app — background nohup from Cursor gets killed → window closes.
if [[ "$(uname -s)" == "Darwin" && "${START_EMULATOR_INLINE:-}" != "1" ]]; then
  echo "Opening emulator in Terminal (stays open after Cursor)..."
  open "$ROOT/scripts/open-android-emulator.command"
else
  echo "Starting Android emulator: $ANDROID_AVD"
  EMULATOR_GPU="${EMULATOR_GPU:-auto}"
  nohup emulator \
    -avd "$ANDROID_AVD" \
    -gpu "$EMULATOR_GPU" \
    -no-snapshot \
    -no-boot-anim \
    >>"$EMULATOR_LOG" 2>&1 &
fi

echo "Waiting for emulator to boot (up to 3 min)..."
adb wait-for-device
for _ in $(seq 1 90); do
  booted="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  if [[ "$booted" == "1" ]]; then
    DEVICE_ID="$(adb devices | awk '/^emulator-.*device/{print $1; exit}')"
    echo "Emulator ready: ${DEVICE_ID:-unknown}"
    exit 0
  fi
  sleep 2
done

echo "Emulator did not finish booting. See $EMULATOR_LOG"
exit 1
