#!/usr/bin/env bash
# Temporary startup diagnosis runner for TRDDK Passenger Android.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT/apps/passenger"
DEVICE="${ANDROID_DEVICE:-emulator-5554}"
OUT_DIR="/tmp/trddk-startup-diagnosis"
ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$ANDROID_HOME/platform-tools/adb"
PKG=com.tardadi.tardadi_passenger

DART_DEFINES=(
  --dart-define=TRDDK_GOOGLE_MAPS_API_KEY="${TRDDK_GOOGLE_MAPS_API_KEY:-AIzaSyA9F15H3pU03Jq7Fi5LbH-3xbNVRJX6aSA}"
  --dart-define=TRDDK_GOOGLE_MAPS_MAP_ID="${TRDDK_GOOGLE_MAPS_MAP_ID:-60c310628a438a911067393f}"
)

mkdir -p "$OUT_DIR"

wait_for_device() {
  "$ADB" wait-for-device
  for _ in $(seq 1 90); do
    booted="$("$ADB" -s "$DEVICE" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
    if [[ "$booted" == "1" ]]; then
      return 0
    fi
    sleep 2
  done
  echo "Emulator did not finish booting" >&2
  return 1
}

ensure_emulator() {
  if "$ADB" devices | awk 'NR>1 && $1 ~ /^emulator-/ && $2=="device" {found=1} END {exit !found}'; then
    DEVICE="$("$ADB" devices | awk '/^emulator-.*device$/{print $1; exit}')"
    export DEVICE
    return 0
  fi

  if command -v emulator >/dev/null 2>&1; then
    local avd
    avd="$(emulator -list-avds | head -1)"
    if [[ -n "$avd" ]]; then
      echo "Starting emulator: $avd"
      nohup emulator -avd "$avd" -no-snapshot-load >/tmp/trddk-emulator.log 2>&1 &
      wait_for_device
      DEVICE="$("$ADB" devices | awk '/^emulator-.*device$/{print $1; exit}')"
      export DEVICE
      return 0
    fi
  fi

  echo "No Android emulator/device available" >&2
  return 1
}

extract_metrics() {
  local log_file="$1"
  local prefix="$2"
  local first_frame skipped davey startup_lines

  first_frame="$(rg -o '\[STARTUP\]\[first_frame\]\[[0-9]+ms\]' "$log_file" | head -1 | rg -o '[0-9]+' | head -1 || true)"
  startup_lines="$(rg '\[STARTUP\]' "$log_file" || true)"
  skipped="$("$ADB" -s "$DEVICE" logcat -d -t 400 2>/dev/null | rg 'Skipped [0-9]+ frames' | tail -1 || true)"
  davey="$("$ADB" -s "$DEVICE" logcat -d -t 400 2>/dev/null | rg 'Davey! duration=[0-9]+ms' | tail -1 || true)"
  anr="$("$ADB" -s "$DEVICE" logcat -d -t 400 2>/dev/null | rg -i 'ANR|not responding' | tail -3 || true)"

  {
    echo "=== $prefix metrics ==="
    echo "first_frame_ms=${first_frame:-unknown}"
    echo "push_replacement_end=$(rg '\[STARTUP\]\[push_replacement\]\[[0-9]+ms\]\[end\]' "$log_file" | tail -1 || true)"
    echo "routes_first_build_post=$(rg '\[STARTUP\]\[routes_first_build\].*post_frame' "$log_file" | tail -1 || true)"
    echo "get_routes_end=$(rg '\[STARTUP\]\[get_routes\].*\[end\]' "$log_file" | tail -1 || true)"
    echo "skipped_frames=${skipped:-none}"
    echo "davey=${davey:-none}"
    echo "anr=${anr:-none}"
    echo
    echo "--- STARTUP timeline ---"
    rg '\[STARTUP\]' "$log_file" || true
  } > "$OUT_DIR/${prefix}-summary.txt"

  cp "$log_file" "$OUT_DIR/${prefix}-flutter.log"
}

run_mode() {
  local mode="$1"
  shift
  local extra_flags=("$@")
  local log_file="$OUT_DIR/${mode}.log"

  echo "===== Running mode: $mode ====="
  "$ADB" -s "$DEVICE" logcat -c || true
  "$ADB" -s "$DEVICE" shell am force-stop "$PKG" || true

  cd "$APP_DIR"
  timeout 240 flutter run "${extra_flags[@]}" -d "$DEVICE" "${DART_DEFINES[@]}" \
    >"$log_file" 2>&1 || true

  sleep 8
  "$ADB" -s "$DEVICE" logcat -d -t 500 > "$OUT_DIR/${mode}-logcat.txt" 2>/dev/null || true
  extract_metrics "$log_file" "$mode"
  "$ADB" -s "$DEVICE" shell am force-stop "$PKG" || true
}

run_release_apk() {
  local log_file="$OUT_DIR/release-apk.log"
  cd "$APP_DIR"

  echo "===== Building and installing release APK ====="
  flutter build apk --release "${DART_DEFINES[@]}"

  "$ADB" -s "$DEVICE" logcat -c || true
  "$ADB" -s "$DEVICE" shell am force-stop "$PKG" || true
  "$ADB" -s "$DEVICE" install -r build/app/outputs/flutter-apk/app-release.apk
  "$ADB" -s "$DEVICE" shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 \
    >"$log_file" 2>&1 || true

  sleep 12
  "$ADB" -s "$DEVICE" logcat -d -t 500 > "$OUT_DIR/release-apk-logcat.txt" 2>/dev/null || true

  {
    echo "=== release-apk metrics ==="
    rg 'Skipped [0-9]+ frames' "$OUT_DIR/release-apk-logcat.txt" | tail -1 || true
    rg 'Davey! duration=[0-9]+ms' "$OUT_DIR/release-apk-logcat.txt" | tail -1 || true
    rg -i 'ANR|not responding|FATAL' "$OUT_DIR/release-apk-logcat.txt" | tail -5 || true
    rg '\[STARTUP\]' "$OUT_DIR/release-apk-logcat.txt" || true
  } > "$OUT_DIR/release-apk-summary.txt"
}

ensure_emulator
cd "$APP_DIR"
flutter pub get >/dev/null

run_mode debug --debug
run_mode profile --profile
run_mode profile_no_impeller --profile --no-enable-impeller
run_mode release --release
run_release_apk

echo "Diagnosis artifacts written to $OUT_DIR"
