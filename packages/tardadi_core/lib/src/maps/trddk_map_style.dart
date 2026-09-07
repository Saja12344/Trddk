import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gmaps;

import '../config/google_maps_config.dart';

/// Trddk map appearance — cloud Map ID when configured, dark navy JSON on mobile.
abstract final class TrddkMapStyle {
  /// Minified dark navy JSON (Admin / Map ID "trddk" intent).
  static const darkNavyJson =
      r'[{"elementType":"geometry","stylers":[{"color":"#12144a"}]},'
      r'{"elementType":"labels.text.fill","stylers":[{"color":"#b8bdd4"}]},'
      r'{"elementType":"labels.text.stroke","stylers":[{"color":"#12144a"}]},'
      r'{"featureType":"administrative","elementType":"geometry","stylers":[{"color":"#24277a"}]},'
      r'{"featureType":"poi","elementType":"labels.text.fill","stylers":[{"color":"#8b93b8"}]},'
      r'{"featureType":"poi.park","elementType":"geometry","stylers":[{"color":"#1a1f5c"}]},'
      r'{"featureType":"road","elementType":"geometry","stylers":[{"color":"#2f3768"}]},'
      r'{"featureType":"road","elementType":"geometry.stroke","stylers":[{"color":"#434d85"}]},'
      r'{"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#3d4788"}]},'
      r'{"featureType":"road.highway","elementType":"geometry.stroke","stylers":[{"color":"#5a6499"}]},'
      r'{"featureType":"road.local","elementType":"labels.text.fill","stylers":[{"color":"#9aa3c7"}]},'
      r'{"featureType":"transit","elementType":"geometry","stylers":[{"color":"#24277a"}]},'
      r'{"featureType":"water","elementType":"geometry","stylers":[{"color":"#0e1133"}]}]';

  /// Prefer cloud Map ID only when explicitly enabled (requires Maps SDK on same GCP project).
  static bool get useCloudMapId {
    const enabled = bool.fromEnvironment('TRDDK_USE_CLOUD_MAP_ID');
    return kIsWeb || enabled;
  }

  static String? get cloudMapId =>
      useCloudMapId ? TrddkGoogleMapsConfig.resolvedMapId : null;

  static String? get nativeStyleJson =>
      useCloudMapId ? null : darkNavyJson;

  /// Apply dark style after map creation (iOS sometimes ignores initial widget style).
  static Future<bool> applyNativeStyle(
    gmaps.GoogleMapController controller,
  ) async {
    final style = nativeStyleJson;
    if (style == null) return true;
    try {
      await controller.setMapStyle(style);
      // Brief pause so styled tiles render before revealing the map.
      await Future<void>.delayed(const Duration(milliseconds: 120));
      return true;
    } catch (_) {
      return false;
    }
  }

  static const backgroundColor = Color(0xFF12144A);
}
