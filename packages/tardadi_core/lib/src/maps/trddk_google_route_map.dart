import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gmaps;
import 'package:latlong2/latlong.dart';
import '../config/google_maps_config.dart';
import '../models/models.dart';
import '../utils/route_polyline.dart';
import '../maps/trddk_map_markers.dart';

/// Google Maps route preview — cloud map ID for admin-matched dark styling.
class TrddkGoogleRouteMap extends StatefulWidget {
  const TrddkGoogleRouteMap({
    super.key,
    required this.route,
    required this.stops,
    this.buses = const [],
    this.driverPosition,
    this.driverHeading,
    this.routeColor = const Color(0xFFEB4F26),
    this.borderRadius = 16,
    this.padding = 48,
    this.followDriver = false,
    this.onUserMapGesture,
    this.compactMarkers = false,
  });

  final RouteModel route;
  final List<StopModel> stops;
  final List<BusModel> buses;
  final GeoPoint? driverPosition;
  final double? driverHeading;
  final Color routeColor;
  final double borderRadius;
  final double padding;
  final bool followDriver;
  final VoidCallback? onUserMapGesture;
  final bool compactMarkers;

  @override
  State<TrddkGoogleRouteMap> createState() => _TrddkGoogleRouteMapState();
}

class _TrddkGoogleRouteMapState extends State<TrddkGoogleRouteMap> {
  gmaps.GoogleMapController? _controller;
  Set<gmaps.Marker> _markers = {};
  Set<gmaps.Polyline> _polylines = {};
  Set<gmaps.Circle> _circles = {};
  var _followEnabled = true;
  var _cameraBusy = false;
  String? _lastCameraKey;

  @override
  void initState() {
    super.initState();
    _followEnabled = widget.followDriver;
    _rebuildOverlays();
  }

  @override
  void didUpdateWidget(covariant TrddkGoogleRouteMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.followDriver && !oldWidget.followDriver) {
      _followEnabled = true;
    }

    final dataChanged = oldWidget.route.routeId != widget.route.routeId ||
        oldWidget.route.polyline != widget.route.polyline ||
        oldWidget.stops.length != widget.stops.length ||
        oldWidget.buses.length != widget.buses.length ||
        oldWidget.driverPosition?.latitude != widget.driverPosition?.latitude ||
        oldWidget.driverPosition?.longitude != widget.driverPosition?.longitude;

    if (dataChanged) {
      _rebuildOverlays();
      setState(() {});
    }

    if (!dataChanged) return;

    if (widget.followDriver && _followEnabled) {
      _followDriverCamera();
    } else {
      _fitBounds();
    }
  }

  gmaps.LatLng _toGoogle(LatLng point) =>
      gmaps.LatLng(point.latitude, point.longitude);

  static final _emptyInfo = gmaps.InfoWindow();

  void _rebuildOverlays() {
    final points = resolveRoutePoints(widget.route, widget.stops);
    _polylines = {
      if (points.length >= 2)
        gmaps.Polyline(
          polylineId: const gmaps.PolylineId('route-border'),
          points: points.map(_toGoogle).toList(growable: false),
          color: widget.routeColor.withValues(alpha: 0.35),
          width: 9,
          geodesic: true,
        ),
      if (points.length >= 2)
        gmaps.Polyline(
          polylineId: const gmaps.PolylineId('route'),
          points: points.map(_toGoogle).toList(growable: false),
          color: widget.routeColor,
          width: 5,
          geodesic: true,
        ),
    };

    final markers = <gmaps.Marker>{};
    final from = widget.route.fromLocation;
    final to = widget.route.toLocation;

    if (from != null) {
      markers.add(
        gmaps.Marker(
          markerId: const gmaps.MarkerId('start'),
          position: gmaps.LatLng(from.latitude, from.longitude),
          icon: gmaps.BitmapDescriptor.defaultMarkerWithHue(
            gmaps.BitmapDescriptor.hueGreen,
          ),
          infoWindow: _emptyInfo,
          anchor: const Offset(0.5, 1.0),
        ),
      );
    }
    if (to != null) {
      markers.add(
        gmaps.Marker(
          markerId: const gmaps.MarkerId('end'),
          position: gmaps.LatLng(to.latitude, to.longitude),
          icon: gmaps.BitmapDescriptor.defaultMarkerWithHue(
            gmaps.BitmapDescriptor.hueRed,
          ),
          infoWindow: _emptyInfo,
          anchor: const Offset(0.5, 0.5),
        ),
      );
    }

    for (final stop in widget.stops) {
      markers.add(
        gmaps.Marker(
          markerId: gmaps.MarkerId('stop-${stop.stopId}'),
          position: gmaps.LatLng(stop.latitude, stop.longitude),
          icon: gmaps.BitmapDescriptor.defaultMarkerWithHue(
            gmaps.BitmapDescriptor.hueOrange,
          ),
          infoWindow: _emptyInfo,
          anchor: const Offset(0.5, 0.5),
        ),
      );
    }

    for (final bus in widget.buses) {
      final loc = bus.currentLocation;
      if (loc == null) continue;
      final busPoint = LatLng(loc.latitude, loc.longitude);
      final heading = resolveMarkerHeading(
        point: busPoint,
        routePoints: points,
      );
      markers.add(
        gmaps.Marker(
          markerId: gmaps.MarkerId('bus-${bus.busId}'),
          position: gmaps.LatLng(loc.latitude, loc.longitude),
          icon: gmaps.BitmapDescriptor.defaultMarkerWithHue(
            gmaps.BitmapDescriptor.hueAzure,
          ),
          infoWindow: _emptyInfo,
          rotation: heading,
          flat: true,
          anchor: const Offset(0.5, 0.5),
        ),
      );
    }

    final driver = widget.driverPosition;
    final circles = <gmaps.Circle>{};
    if (driver != null) {
      final driverPos = gmaps.LatLng(driver.latitude, driver.longitude);
      final driverPoint = LatLng(driver.latitude, driver.longitude);
      final heading = resolveMarkerHeading(
        point: driverPoint,
        routePoints: points,
        deviceHeading: widget.driverHeading,
      );
      markers.add(
        gmaps.Marker(
          markerId: const gmaps.MarkerId('driver'),
          position: driverPos,
          icon: gmaps.BitmapDescriptor.defaultMarkerWithHue(
            gmaps.BitmapDescriptor.hueAzure,
          ),
          infoWindow: _emptyInfo,
          rotation: heading,
          flat: true,
          anchor: const Offset(0.5, 0.5),
        ),
      );
    }

    _markers = markers;
    _circles = circles;
  }

  gmaps.LatLng _initialTarget() {
    final points = resolveRoutePoints(widget.route, widget.stops);
    if (points.isEmpty) return const gmaps.LatLng(24.7136, 46.6753);
    return _toGoogle(points.first);
  }

  gmaps.LatLngBounds _expandBounds(
    double minLat,
    double maxLat,
    double minLng,
    double maxLng,
  ) {
    const minDelta = 0.002;
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
    return gmaps.LatLngBounds(
      southwest: gmaps.LatLng(minLat, minLng),
      northeast: gmaps.LatLng(maxLat, maxLng),
    );
  }

  String _cameraKeyForBounds(gmaps.LatLngBounds bounds, {bool follow = false}) {
    final sw = bounds.southwest;
    final ne = bounds.northeast;
    return '${follow ? 'f' : 'b'}:${sw.latitude},${sw.longitude},${ne.latitude},${ne.longitude}';
  }

  Future<void> _fitBounds() async {
    final controller = _controller;
    if (controller == null || _cameraBusy) return;
    final points = resolveRoutePoints(widget.route, widget.stops);
    final driver = widget.driverPosition;
    if (points.isEmpty && driver == null) return;

    var minLat = points.isEmpty ? driver!.latitude : points.first.latitude;
    var maxLat = minLat;
    var minLng = points.isEmpty ? driver!.longitude : points.first.longitude;
    var maxLng = minLng;

    for (final p in points) {
      minLat = math.min(minLat, p.latitude);
      maxLat = math.max(maxLat, p.latitude);
      minLng = math.min(minLng, p.longitude);
      maxLng = math.max(maxLng, p.longitude);
    }
    if (driver != null) {
      minLat = math.min(minLat, driver.latitude);
      maxLat = math.max(maxLat, driver.latitude);
      minLng = math.min(minLng, driver.longitude);
      maxLng = math.max(maxLng, driver.longitude);
    }

    final bounds = _expandBounds(minLat, maxLat, minLng, maxLng);
    final key = _cameraKeyForBounds(bounds);
    if (_lastCameraKey == key) return;

    _cameraBusy = true;
    try {
      await controller
          .animateCamera(
            gmaps.CameraUpdate.newLatLngBounds(bounds, widget.padding),
          )
          .timeout(const Duration(seconds: 2));
      _lastCameraKey = key;
    } catch (_) {
      try {
        await controller.moveCamera(
          gmaps.CameraUpdate.newLatLngBounds(bounds, widget.padding),
        );
        _lastCameraKey = key;
      } catch (_) {}
    } finally {
      _cameraBusy = false;
    }
  }

  Future<void> _followDriverCamera() async {
    final controller = _controller;
    final driver = widget.driverPosition;
    if (controller == null || driver == null || _cameraBusy) return;

    final target = gmaps.LatLng(driver.latitude, driver.longitude);
    final key = 'f:${target.latitude},${target.longitude}';
    if (_lastCameraKey == key) return;

    _cameraBusy = true;
    try {
      await controller
          .animateCamera(
            gmaps.CameraUpdate.newCameraPosition(
              gmaps.CameraPosition(
                target: target,
                zoom: 16,
                bearing: widget.driverHeading ?? 0,
                tilt: 0,
              ),
            ),
          )
          .timeout(const Duration(seconds: 2));
      _lastCameraKey = key;
    } catch (_) {
      try {
        await controller.moveCamera(
          gmaps.CameraUpdate.newLatLng(target),
        );
        _lastCameraKey = key;
      } catch (_) {}
    } finally {
      _cameraBusy = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final mapId = TrddkGoogleMapsConfig.resolvedMapId;
    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.borderRadius),
      child: gmaps.GoogleMap(
        cloudMapId: mapId,
        initialCameraPosition: gmaps.CameraPosition(
          target: _initialTarget(),
          zoom: 13,
        ),
        markers: _markers,
        polylines: _polylines,
        circles: _circles,
        myLocationButtonEnabled: false,
        zoomControlsEnabled: false,
        mapToolbarEnabled: false,
        compassEnabled: false,
        onCameraMoveStarted: widget.onUserMapGesture,
        onMapCreated: (controller) async {
          _controller = controller;
          if (widget.followDriver && widget.driverPosition != null) {
            await _followDriverCamera();
          } else {
            await _fitBounds();
          }
        },
      ),
    );
  }
}
