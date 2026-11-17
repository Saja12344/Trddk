# Android setup

Use this once on a machine before running the passenger or driver app on an Android emulator.

## 1) Install Android Studio

1. Download: https://developer.android.com/studio
2. Install and open Android Studio
3. Complete first-run setup (Standard install)

## 2) Install SDK components

In Android Studio:

1. **Settings / Preferences** → **Languages & Frameworks** → **Android SDK**
2. **SDK Platforms** tab → enable latest Android (API 34 or 35)
3. **SDK Tools** tab → enable:
   - Android SDK Build-Tools
   - Android SDK Platform-Tools
   - Android Emulator
   - Android SDK Command-line Tools
4. Apply / OK

## 3) Create an Android Virtual Device (AVD)

1. Open **Device Manager** in Android Studio
2. Click **Create Device**
3. Pick a phone (for example Pixel 7)
4. Pick a system image (API 34 or newer)
5. Finish and name it (for example `Pixel_7_API_34`)

## 4) Point Flutter to the Android SDK

```bash
flutter doctor
```

If Android SDK is not detected:

```bash
flutter config --android-sdk ~/Library/Android/sdk
flutter doctor --android-licenses
```

Accept all licenses.

## 5) Run an app

From the repository root, after `npm install`:

```bash
npm run dev:passenger:android
# or
npm run dev:driver:android
```

If the emulator name is custom:

```bash
ANDROID_AVD=Pixel_7_API_34 npm run dev:passenger:android
```

Passenger can use the iOS simulator instead:

```bash
npm run dev:passenger:ios
```

## Verify

```bash
flutter devices
```

You should see a device similar to:

```
sdk gphone64 arm64 (mobile) • emulator-5554 • android-arm64 • Android ...
```

## Common issues

| Issue | Fix |
|---|---|
| `Unable to locate Android SDK` | Install Android Studio and run `flutter config --android-sdk` |
| `No Android AVD found` | Create an AVD in Device Manager |
| `emulator: command not found` | Add `~/Library/Android/sdk/emulator` to `PATH` |
| App can't reach the API | Start the backend with `npm run dev:backend` on a machine the emulator can reach |
