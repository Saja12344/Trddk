import 'package:flutter/material.dart';

/// Driver map tiles — OpenFreeMap fallback when Google Maps is unavailable.
class DriverMapConfig {
  static const tilesUrl =
      'https://tiles.openfreemap.org/osm/{z}/{x}/{y}.png';
  static const tileSubdomains = <String>[];

  static const routeOrange = Color(0xFFEB4F26);
  static const startGreen = Color(0xFF4ADE80);
  static const endRed = Color(0xFFF87171);
}
