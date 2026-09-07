/// Passenger map tiles — OpenFreeMap (no API key watermark).
abstract final class PassengerMapConfig {
  static const tilesUrl =
      'https://tiles.openfreemap.org/osm/{z}/{x}/{y}.png';
  static const tileSubdomains = <String>[];
  static const userAgentPackageName = 'com.tardadi.tardadiPassenger';
}
