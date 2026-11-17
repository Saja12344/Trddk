import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../theme/map_colors.dart';
import '../utils/heading_utils.dart';
import '../utils/route_polyline.dart';

/// Delivery-style navigation chevron (points along [heading] degrees).
class TrddkNavigationMarker extends StatelessWidget {
  const TrddkNavigationMarker({
    super.key,
    required this.heading,
    this.color = TrddkMapColors.offlineBusBlue,
    this.size = 36,
    this.showPulse = true,
  });

  final double heading;
  final Color color;
  final double size;
  final bool showPulse;

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        if (showPulse)
          Container(
            width: size + 10,
            height: size + 10,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.18),
              shape: BoxShape.circle,
            ),
          ),
        Transform.rotate(
          angle: (heading - 45) * math.pi / 180,
          child: Icon(
            Icons.navigation_rounded,
            color: color,
            size: size,
            shadows: const [
              Shadow(
                color: Color(0x99000000),
                blurRadius: 4,
                offset: Offset(0, 1),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

double resolveMarkerHeading({
  required LatLng point,
  required List<LatLng> routePoints,
  double? deviceHeading,
}) {
  if (deviceHeading != null && deviceHeading.isFinite && deviceHeading != 0) {
    return deviceHeading;
  }
  if (routePoints.length < 2) return 0;

  final index = nearestPointIndex(routePoints, point);
  final from = routePoints[index];
  final to = index < routePoints.length - 1
      ? routePoints[index + 1]
      : routePoints[index];
  return headingBetween(
    fromLat: from.latitude,
    fromLng: from.longitude,
    toLat: to.latitude,
    toLng: to.longitude,
  );
}

LatLngBounds expandLatLngBounds(LatLngBounds bounds, {double minDelta = 0.006}) {
  var minLat = bounds.southWest.latitude;
  var maxLat = bounds.northEast.latitude;
  var minLng = bounds.southWest.longitude;
  var maxLng = bounds.northEast.longitude;

  if ((maxLat - minLat).abs() < minDelta) {
    final mid = (maxLat + minLat) / 2;
    minLat = mid - minDelta / 2;
    maxLat = mid + minDelta / 2;
  }
  if ((maxLng - minLng).abs() < minDelta) {
    final mid = (maxLng + minLng) / 2;
    minLng = mid - minDelta / 2;
    maxLng = mid + minDelta / 2;
  }

  return LatLngBounds(LatLng(minLat, minLng), LatLng(maxLat, maxLng));
}
