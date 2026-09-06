import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gmaps;
import 'package:latlong2/latlong.dart';

import '../models/models.dart';
import '../utils/route_polyline.dart';
import '../maps/trddk_map_bitmaps.dart';
import '../maps/trddk_map_markers.dart';
import '../maps/trddk_map_style.dart';

/// Passenger bus-tracking map — stable top-down overview, no navigation mode.
class PassengerTrackingGoogleMap extends StatefulWidget {
  const PassengerTrackingGoogleMap({
    super.key,
    required this.route,
    required this.stops,
    required this.buses,
    required this.routeColor,
    this.passengerPosition,
    this.borderRadius = 16,
    this.padding = 52,
    this.roadPolyline,
  });

  final RouteModel route;
  final List<StopModel> stops;
  final List<BusModel> buses;
  final Color routeColor;
  final GeoPoint? passengerPosition;
  final double borderRadius;
  final double padding;
  final List<LatLng>? roadPolyline;

  @override
  State<PassengerTrackingGoogleMap> createState() =>
      _PassengerTrackingGoogleMapState();
}

class _PassengerTrackingGoogleMapState extends State<PassengerTrackingGoogleMap> {
  gmaps.GoogleMapController? _controller;
  gmaps.BitmapDescriptor? _passengerIcon;
  gmaps.BitmapDescriptor? _busIcon;
  gmaps.BitmapDescriptor? _stopIcon;
  gmaps.BitmapDescriptor? _stopNextIcon;
  var _cameraFitted = false;
  var _cameraBusy = false;
  var _mapVisible = false;
  Set<gmaps.Marker> _markers = {};
  Set<gmaps.Polyline> _polylines = {};

  static const _emptyInfo = gmaps.InfoWindow();

  @override
  void initState() {
    super.initState();
    _loadIcons();
    _rebuildOverlays();
  }

  @override
  void didUpdateWidget(covariant PassengerTrackingGoogleMap oldWidget) {
    super.didUpdateWidget(oldWidget);

    final routeChanged = oldWidget.route.routeId != widget.route.routeId ||
        oldWidget.route.polyline != widget.route.polyline ||
        oldWidget.stops.length != widget.stops.length;

    _rebuildOverlays();
    setState(() {});

    if (routeChanged) {
      _cameraFitted = false;
      _fitTrackingBounds();
    }
  }

  Future<void> _loadIcons() async {
    final results = await Future.wait([
      passengerDotBitmap(),
      navigationArrowBitmap(),
      stopMarkerBitmap(),
      stopMarkerBitmap(highlighted: true),
    ]);
    if (!mounted) return;
    _passengerIcon = results[0];
    _busIcon = results[1];
    _stopIcon = results[2];
    _stopNextIcon = results[3];
    _rebuildOverlays();
    setState(() {});
  }

  List<LatLng> get _routePoints {
    if (widget.roadPolyline != null && widget.roadPolyline!.length >= 2) {
      return widget.roadPolyline!;
    }
    return resolveRoutePoints(widget.route, widget.stops);
  }

  gmaps.LatLng _g(LatLng p) => gmaps.LatLng(p.latitude, p.longitude);

  int? _resolveNextStopIndex(List<StopModel> orderedStops) {
    for (final bus in widget.buses) {
      final lastStopId = bus.lastArrivedStopId;
      if (lastStopId == null || lastStopId.isEmpty) continue;
      final idx = orderedStops.indexWhere((stop) => stop.stopId == lastStopId);
      if (idx >= 0 && idx + 1 < orderedStops.length) return idx + 1;
    }
    return orderedStops.isEmpty ? null : 0;
  }

  void _rebuildOverlays() {
    final points = _routePoints;
    _polylines = {
      if (points.length >= 2)
        gmaps.Polyline(
          polylineId: const gmaps.PolylineId('route-shadow'),
          points: points.map(_g).toList(growable: false),
          color: widget.routeColor.withValues(alpha: 0.35),
          width: 8,
          geodesic: true,
          zIndex: 1,
        ),
      if (points.length >= 2)
        gmaps.Polyline(
          polylineId: const gmaps.PolylineId('route'),
          points: points.map(_g).toList(growable: false),
          color: widget.routeColor,
          width: 5,
          geodesic: true,
          zIndex: 2,
        ),
    };

    final markers = <gmaps.Marker>{};
    final orderedStops = [...widget.stops]
      ..sort((a, b) => a.sequenceNo.compareTo(b.sequenceNo));
    final nextStopIndex = _resolveNextStopIndex(orderedStops);

    for (var i = 0; i < orderedStops.length; i++) {
      final stop = orderedStops[i];
      final isNext = i == nextStopIndex;
      markers.add(
        gmaps.Marker(
          markerId: gmaps.MarkerId('stop-${stop.stopId}'),
          position: gmaps.LatLng(stop.latitude, stop.longitude),
          icon: isNext
              ? (_stopNextIcon ??
                  gmaps.BitmapDescriptor.defaultMarkerWithHue(
                    gmaps.BitmapDescriptor.hueAzure,
                  ))
              : (_stopIcon ??
                  gmaps.BitmapDescriptor.defaultMarkerWithHue(
                    gmaps.BitmapDescriptor.hueAzure,
                  )),
          infoWindow: gmaps.InfoWindow(title: stop.name),
          anchor: const Offset(0.5, 0.5),
          zIndexInt: isNext ? 3 : 1,
        ),
      );
    }

    final to = widget.route.toLocation;
    if (to != null) {
      markers.add(
        gmaps.Marker(
          markerId: const gmaps.MarkerId('destination'),
          position: gmaps.LatLng(to.latitude, to.longitude),
          icon: gmaps.BitmapDescriptor.defaultMarkerWithHue(
            gmaps.BitmapDescriptor.hueOrange,
          ),
          infoWindow: _emptyInfo,
          anchor: const Offset(0.5, 1.0),
          zIndexInt: 2,
        ),
      );
    }

    final passenger = widget.passengerPosition;
    if (passenger != null) {
      markers.add(
        gmaps.Marker(
          markerId: const gmaps.MarkerId('passenger'),
          position: gmaps.LatLng(passenger.latitude, passenger.longitude),
          icon: _passengerIcon ??
              gmaps.BitmapDescriptor.defaultMarkerWithHue(
                gmaps.BitmapDescriptor.hueAzure,
              ),
          infoWindow: _emptyInfo,
          anchor: const Offset(0.5, 0.5),
          zIndexInt: 4,
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
          position: _g(busPoint),
          icon: _busIcon ??
              gmaps.BitmapDescriptor.defaultMarkerWithHue(
                gmaps.BitmapDescriptor.hueAzure,
              ),
          infoWindow: gmaps.InfoWindow(title: bus.label),
          rotation: heading,
          flat: true,
          anchor: const Offset(0.5, 0.5),
          zIndexInt: 10,
        ),
      );
    }

    _markers = markers;
  }

  Future<void> _fitTrackingBounds() async {
    if (_cameraFitted || _cameraBusy) return;
    final controller = _controller;
    if (controller == null) return;

    final points = <LatLng>[..._routePoints];
    final passenger = widget.passengerPosition;
    if (passenger != null) {
      points.add(LatLng(passenger.latitude, passenger.longitude));
    }
    for (final bus in widget.buses) {
      final loc = bus.currentLocation;
      if (loc != null) {
        points.add(LatLng(loc.latitude, loc.longitude));
      }
    }
    for (final stop in widget.stops) {
      points.add(LatLng(stop.latitude, stop.longitude));
    }

    if (points.isEmpty) return;

    var minLat = points.first.latitude;
    var maxLat = points.first.latitude;
    var minLng = points.first.longitude;
    var maxLng = points.first.longitude;
    for (final p in points.skip(1)) {
      minLat = math.min(minLat, p.latitude);
      maxLat = math.max(maxLat, p.latitude);
      minLng = math.min(minLng, p.longitude);
      maxLng = math.max(maxLng, p.longitude);
    }

    const minDelta = 0.006;
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

    _cameraBusy = true;
    try {
      await controller.animateCamera(
        gmaps.CameraUpdate.newLatLngBounds(
          gmaps.LatLngBounds(
            southwest: gmaps.LatLng(minLat, minLng),
            northeast: gmaps.LatLng(maxLat, maxLng),
          ),
          widget.padding,
        ),
      );
      _cameraFitted = true;
    } catch (_) {
      try {
        await controller.moveCamera(
          gmaps.CameraUpdate.newLatLngBounds(
            gmaps.LatLngBounds(
              southwest: gmaps.LatLng(minLat, minLng),
              northeast: gmaps.LatLng(maxLat, maxLng),
            ),
            widget.padding,
          ),
        );
        _cameraFitted = true;
      } catch (_) {}
    } finally {
      _cameraBusy = false;
    }
  }

  gmaps.LatLng _initialTarget() {
    for (final bus in widget.buses) {
      final loc = bus.currentLocation;
      if (loc != null) {
        return gmaps.LatLng(loc.latitude, loc.longitude);
      }
    }
    final points = _routePoints;
    if (points.isNotEmpty) return _g(points.first);
    return const gmaps.LatLng(24.7136, 46.6753);
  }

  @override
  Widget build(BuildContext context) {
    final mapId = TrddkMapStyle.cloudMapId;
    final mapStyle = TrddkMapStyle.nativeStyleJson;

    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.borderRadius),
      child: Stack(
        children: [
          const Positioned.fill(
            child: ColoredBox(color: TrddkMapStyle.backgroundColor),
          ),
          AnimatedOpacity(
            opacity: _mapVisible ? 1 : 0,
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
            child: gmaps.GoogleMap(
              mapId: mapId,
              style: mapStyle,
              initialCameraPosition: gmaps.CameraPosition(
                target: _initialTarget(),
                zoom: 13,
                tilt: 0,
                bearing: 0,
              ),
              markers: _markers,
              polylines: _polylines,
              myLocationEnabled: false,
              myLocationButtonEnabled: false,
              zoomControlsEnabled: false,
              mapToolbarEnabled: false,
              compassEnabled: false,
              onMapCreated: (controller) async {
                _controller = controller;
                await TrddkMapStyle.applyNativeStyle(controller);
                await _fitTrackingBounds();
                if (mounted) setState(() => _mapVisible = true);
              },
            ),
          ),
        ],
      ),
    );
  }
}
