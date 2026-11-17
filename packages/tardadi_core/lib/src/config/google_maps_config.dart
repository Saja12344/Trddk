import 'package:flutter/foundation.dart';

/// Google Maps keys via `--dart-define` — never commit secrets.
abstract final class TrddkGoogleMapsConfig {
  /// Map ID from Google Cloud → Map Management (display name: trddk).
  /// Dark style `6637bbb701c0f4712d80b34b` is linked to this Map ID in the console.
  static const defaultMapId = '60c310628a438a911067393f';

  /// Same GCP project as Admin — required for cloud Map ID styling.
  static const defaultApiKey = 'AIzaSyAmVXpB4849FWhnK96ea2bg3Q-tO8aOdok';

  static const apiKey = String.fromEnvironment(
    'TRDDK_GOOGLE_MAPS_API_KEY',
    defaultValue: defaultApiKey,
  );
  static const mapId = String.fromEnvironment(
    'TRDDK_GOOGLE_MAPS_MAP_ID',
    defaultValue: defaultMapId,
  );

  /// Resolved Map ID — always the trddk cloud style unless overridden at build time.
  static String get resolvedMapId {
    final value = mapId.trim();
    return value.isNotEmpty ? value : defaultMapId;
  }

  /// Native Google Maps on iOS/Android (GMSApiKey is embedded in Info.plist).
  static bool get isConfigured {
    if (kIsWeb) return apiKey.trim().isNotEmpty;
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
      case TargetPlatform.android:
        return true;
      default:
        return apiKey.trim().isNotEmpty;
    }
  }
}
