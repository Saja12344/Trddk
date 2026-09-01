import 'package:latlong2/latlong.dart';

import '../api/tardadi_api.dart';
import '../models/models.dart';
import '../utils/route_polyline.dart';

/// Caches road routes and avoids re-fetching on every GPS tick.
class NavigationRouteManager {
  NavigationRouteManager(this._api);

  static const refetchInterval = Duration(minutes: 5);
  static const offRouteThresholdMeters = 80.0;

  final TardadiApi _api;
  NavigationRouteResult? _cached;
  DateTime? _lastFetch;
  String? _cacheKey;

  NavigationRouteResult? get cached => _cached;

  void reset() {
    _cached = null;
    _lastFetch = null;
    _cacheKey = null;
  }

  String _cacheKeyFor({
    required GeoPoint origin,
    required GeoPoint destination,
    required List<GeoPoint> waypoints,
  }) {
    final waypointKey = waypoints
        .map((w) => '${w.latitude},${w.longitude}')
        .join('|');
    return '${origin.latitude},${origin.longitude}->'
        '${destination.latitude},${destination.longitude}:$waypointKey';
  }

  bool needsRefetch({
    required GeoPoint origin,
    required GeoPoint destination,
    required List<GeoPoint> waypoints,
    required double offRouteMeters,
    required bool force,
  }) {
    if (force || _cached == null) return true;
    final key = _cacheKeyFor(
      origin: origin,
      destination: destination,
      waypoints: waypoints,
    );
    if (_cacheKey != key) return true;
    if (offRouteMeters > offRouteThresholdMeters) return true;
    if (_lastFetch != null &&
        DateTime.now().difference(_lastFetch!) > refetchInterval) {
      return true;
    }
    return false;
  }

  Future<NavigationRouteResult> ensureRoute({
    required GeoPoint origin,
    required GeoPoint destination,
    List<GeoPoint> waypoints = const [],
    String? routeId,
    required double offRouteMeters,
    bool force = false,
  }) async {
    if (!needsRefetch(
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      offRouteMeters: offRouteMeters,
      force: force,
    )) {
      return _cached!;
    }

    final result = await _api.computeNavigationRoute(
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      routeId: routeId,
    );

    _cached = result;
    _lastFetch = DateTime.now();
    _cacheKey = _cacheKeyFor(
      origin: origin,
      destination: destination,
      waypoints: waypoints,
    );
    return result;
  }

  List<LatLng> displayPoints({
    required RouteModel route,
    required List<StopModel> stops,
    NavigationRouteResult? override,
  }) {
    final active = override ?? _cached;
    if (active != null && active.points.length >= 2) {
      return active.points;
    }
    return resolveRoutePoints(route, stops);
  }
}

({GeoPoint origin, GeoPoint destination, List<GeoPoint> waypoints})
    buildRouteOverviewRequest(RouteModel route, List<StopModel> stops) {
  final ordered = [...stops]..sort((a, b) => a.sequenceNo.compareTo(b.sequenceNo));
  final from = route.fromLocation;
  final to = route.toLocation;

  GeoPoint? origin;
  GeoPoint? destination;
  final waypoints = <GeoPoint>[];

  if (from != null) {
    origin = GeoPoint(latitude: from.latitude, longitude: from.longitude);
  }
  if (to != null) {
    destination = GeoPoint(latitude: to.latitude, longitude: to.longitude);
  }

  for (final stop in ordered) {
    waypoints.add(
      GeoPoint(latitude: stop.latitude, longitude: stop.longitude),
    );
  }

  if (origin == null && ordered.isNotEmpty) {
    final first = ordered.first;
    origin = GeoPoint(latitude: first.latitude, longitude: first.longitude);
    waypoints.removeAt(0);
  }
  if (destination == null && ordered.isNotEmpty) {
    final last = ordered.last;
    destination = GeoPoint(latitude: last.latitude, longitude: last.longitude);
    if (waypoints.isNotEmpty &&
        waypoints.last.latitude == destination.latitude &&
        waypoints.last.longitude == destination.longitude) {
      waypoints.removeLast();
    }
  }

  if (origin == null || destination == null) {
    throw StateError('Route overview requires origin and destination');
  }

  return (origin: origin, destination: destination, waypoints: waypoints);
}
