# iOS release

## Bundle IDs

Registered in App Store Connect. Do not change them. Each ID has its own iOS app in Firebase project `trddk-54c45`.

| App | iOS | Android |
|-----|-----|---------|
| Passenger | `com.tardadi.trddk.passenger` | `com.tardadi.tardadi_passenger` |
| Driver | `com.tardadi.tardadi.Driver` | `com.tardadi.tardadi_driver` |

## Archive

1. Bump the build number in the app's `pubspec.yaml` (`version: x.y.z+build`).
2. Open `ios/Runner.xcworkspace` (not the `.xcodeproj`).
3. Archive from that workspace and upload with Xcode or Transporter.

## Firebase

- Each iOS app needs its own `GoogleService-Info.plist`. That file is gitignored. Do not commit it.
- Upload the APNs auth key for both the development and production environments.

## Google Cloud

The **TRDDK Maps iOS** key must list both iOS bundle IDs above.

## App Review

Demo accounts exist for the passenger app and the driver app. The codes live in server config, not in this repository.
