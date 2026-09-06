import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:tardadi_core/tardadi_core.dart';

/// Passenger route tracking — stable top-down overview (not navigation mode).
class PassengerRouteMap extends StatelessWidget {
  const PassengerRouteMap({
    super.key,
    required this.route,
    required this.stops,
    required this.buses,
    this.passengerPosition,
    this.borderRadius = 16,
  });

  final RouteModel route;
  final List<StopModel> stops;
  final List<BusModel> buses;
  final GeoPoint? passengerPosition;
  final double borderRadius;

  List<LatLng> get _roadPolyline => resolveRoutePoints(route, stops);

  Color _routeColor() {
    final hex = route.colorHex.replaceAll('#', '').trim();
    if (hex.length == 6) {
      return Color(int.parse('FF$hex', radix: 16));
    }
    return const Color(0xFFEB4F26);
  }

  @override
  Widget build(BuildContext context) {
    return PassengerTrackingGoogleMap(
      route: route,
      stops: stops,
      buses: buses,
      routeColor: _routeColor(),
      passengerPosition: passengerPosition,
      borderRadius: borderRadius,
      padding: 36,
      roadPolyline: _roadPolyline,
    );
  }
}
