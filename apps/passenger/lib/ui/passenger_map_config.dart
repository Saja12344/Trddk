/// Shared passenger map tiles — Carto dark without retina suffix (avoids API watermark).
abstract final class PassengerMapConfig {
  static const tilesUrl =
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
  static const tileSubdomains = ['a', 'b', 'c', 'd'];
  static const userAgentPackageName = 'com.tardadi.tardadiPassenger';
}
