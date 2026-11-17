import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:tardadi_core/tardadi_core.dart';

/// Driver map — navigation mode during active trips, overview otherwise.
class DriverRouteMap extends StatelessWidget {
  const DriverRouteMap({
    super.key,
    required this.route,
    required this.stops,
    required this.routeColor,
    required this.targetStopIndex,
    this.driverPosition,
    this.driverHeading,
    this.followDriver = false,
    this.navigationPolyline,
    this.trimTraveled = false,
    this.followTopPadding = 64,
  });

  final RouteModel route;
  final List<StopModel> stops;
  final Color routeColor;
  final int targetStopIndex;
  final GeoPoint? driverPosition;
  final double? driverHeading;
  final bool followDriver;
  final List<LatLng>? navigationPolyline;
  final bool trimTraveled;
  final double followTopPadding;

  List<LatLng> get _roadPolyline {
    final navigation = navigationPolyline;
    if (navigation != null && navigation.length >= 2) return navigation;
    return resolveRoutePoints(route, stops);
  }

  @override
  Widget build(BuildContext context) {
    return DriverNavigationGoogleMap(
      route: route,
      stops: stops,
      routeColor: routeColor,
      targetStopIndex: targetStopIndex,
      driverPosition: driverPosition,
      driverHeading: driverHeading,
      followMode: followDriver,
      roadPolyline: _roadPolyline,
      trimTraveled: trimTraveled &&
          navigationPolyline != null &&
          navigationPolyline!.length >= 2,
      followTopPadding: followTopPadding,
      borderRadius: 0,
    );
  }
}
