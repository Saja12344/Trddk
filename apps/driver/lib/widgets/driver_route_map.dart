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
  });

  final RouteModel route;
  final List<StopModel> stops;
  final Color routeColor;
  final int targetStopIndex;
  final GeoPoint? driverPosition;
  final double? driverHeading;
  final bool followDriver;

  List<LatLng> get _roadPolyline => resolveRoutePoints(route, stops);

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
      borderRadius: 0,
    );
  }
}
