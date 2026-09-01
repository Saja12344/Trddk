/// Google Maps keys via `--dart-define` — never commit secrets.
abstract final class TrddkGoogleMapsConfig {
  static const apiKey = String.fromEnvironment('TRDDK_GOOGLE_MAPS_API_KEY');
  static const mapId = String.fromEnvironment('TRDDK_GOOGLE_MAPS_MAP_ID');

  static bool get isConfigured => apiKey.trim().isNotEmpty;
}
