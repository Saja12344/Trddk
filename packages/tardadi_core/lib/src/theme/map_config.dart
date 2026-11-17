/// Shared map tiles — minimal ride-sharing style (closest free match to Uber).
abstract final class TrddkMapConfig {
  static const tilesUrl =
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  static const tileSubdomains = ['a', 'b', 'c', 'd'];
}
