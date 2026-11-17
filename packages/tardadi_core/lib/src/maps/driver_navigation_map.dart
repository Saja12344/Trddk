import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gmaps;
import 'package:latlong2/latlong.dart';

import '../config/google_maps_config.dart';
import '../models/models.dart';
import '../utils/route_polyline.dart';
import '../maps/trddk_map_bitmaps.dart';
import '../maps/trddk_map_markers.dart';
import '../maps/trddk_map_style.dart';

/// Driver navigation map — tilted camera, bearing rotation, follow mode.
class DriverNavigationGoogleMap extends StatefulWidget {
  const DriverNavigationGoogleMap({
    super.key,
    required this.route,
    required this.stops,
    required this.routeColor,
    this.driverPosition,
    this.driverHeading,
    this.followMode = false,
    this.targetStopIndex = 0,
    this.navigationZoom = 17.5,
    this.cameraTilt = 55,
    this.borderRadius = 0,
    this.roadPolyline,
    this.trimTraveled = false,
    this.followTopPadding = 64,
  });

  final RouteModel route;
  final List<StopModel> stops;
  final Color routeColor;
  final GeoPoint? driverPosition;
  final double? driverHeading;
  final bool followMode;
  final int targetStopIndex;
  final double navigationZoom;
  final double cameraTilt;
  final double borderRadius;
  final List<LatLng>? roadPolyline;
  final bool trimTraveled;
  final double followTopPadding;

  @override
  State<DriverNavigationGoogleMap> createState() =>
      _DriverNavigationGoogleMapState();
}

class _DriverNavigationGoogleMapState extends State<DriverNavigationGoogleMap> {
  gmaps.GoogleMapController? _controller;
  gmaps.BitmapDescriptor? _navIcon;
  gmaps.BitmapDescriptor? _stopIcon;
  gmaps.BitmapDescriptor? _stopNextIcon;
  var _followEnabled = true;
  var _cameraBusy = false;
  var _mapVisible = false;
  Set<gmaps.Marker> _markers = {};
  Set<gmaps.Polyline> _polylines = {};

  static const _emptyInfo = gmaps.InfoWindow();

  static const _revealTimeout = Duration(milliseconds: 1500);
  Timer? _revealSafety;

  void _reveal() {
    _revealSafety?.cancel();
    if (mounted && !_mapVisible) setState(() => _mapVisible = true);
  }

  @override
  void initState() {
    super.initState();
    _followEnabled = widget.followMode;
    _loadIcons();
    _rebuildOverlays();
    _revealSafety = Timer(const Duration(seconds: 4), _reveal);
  }

  @override
  void dispose() {
    _revealSafety?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant DriverNavigationGoogleMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.followMode && !oldWidget.followMode) {
      _followEnabled = true;
    }

    final moved = oldWidget.driverPosition?.latitude !=
            widget.driverPosition?.latitude ||
        oldWidget.driverPosition?.longitude !=
            widget.driverPosition?.longitude ||
        oldWidget.driverHeading != widget.driverHeading;

    final routeChanged = oldWidget.route.routeId != widget.route.routeId ||
        oldWidget.route.polyline != widget.route.polyline ||
        oldWidget.stops.length != widget.stops.length;

    _rebuildOverlays();
    setState(() {});

    if (widget.followMode && _followEnabled && moved) {
      _animateNavigationCamera();
    } else if (!widget.followMode && routeChanged) {
      _fitOverview();
    } else if (!widget.followMode && moved) {
      _fitOverview();
    }
  }

  Future<void> _loadIcons() async {
    final results = await Future.wait([
      navigationArrowBitmap(),
      stopMarkerBitmap(),
      stopMarkerBitmap(highlighted: true),
    ]);
    if (!mounted) return;
    _navIcon = results[0];
    _stopIcon = results[1];
    _stopNextIcon = results[2];
    if (!mounted) return;
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

  void _rebuildOverlays() {
    final points = _routePoints;
    final driver = widget.driverPosition;
    final driverLatLng = driver == null
        ? null
        : LatLng(driver.latitude, driver.longitude);

    _polylines = _buildPolylines(points, driverLatLng);
    _markers = _buildMarkers(points, driverLatLng);
  }

  Set<gmaps.Polyline> _buildPolylines(
    List<LatLng> points,
    LatLng? driverLatLng,
  ) {
    if (points.length < 2) return {};

    if (widget.followMode && driverLatLng != null) {
      final split = nearestPointIndex(points, driverLatLng);
      final remaining = <LatLng>[driverLatLng, ...points.skip(split + 1)];
      if (widget.trimTraveled) {
        return {
          if (remaining.length >= 2)
            gmaps.Polyline(
              polylineId: const gmaps.PolylineId('remaining'),
              points: remaining.map(_g).toList(growable: false),
              color: widget.routeColor,
              width: 7,
              geodesic: true,
            ),
        };
      }

      final traveled = points.take(split + 1).toList();
      if (traveled.isEmpty ||
          traveled.last.latitude != driverLatLng.latitude ||
          traveled.last.longitude != driverLatLng.longitude) {
        traveled.add(driverLatLng);
      }

      return {
        if (traveled.length >= 2)
          gmaps.Polyline(
            polylineId: const gmaps.PolylineId('traveled'),
            points: traveled.map(_g).toList(growable: false),
            color: widget.routeColor.withValues(alpha: 0.35),
            width: 6,
            geodesic: true,
          ),
        if (remaining.length >= 2)
          gmaps.Polyline(
            polylineId: const gmaps.PolylineId('remaining'),
            points: remaining.map(_g).toList(growable: false),
            color: widget.routeColor,
            width: 7,
            geodesic: true,
          ),
      };
    }

    return {
      gmaps.Polyline(
        polylineId: const gmaps.PolylineId('route-border'),
        points: points.map(_g).toList(growable: false),
        color: widget.routeColor.withValues(alpha: 0.35),
        width: 9,
        geodesic: true,
      ),
      gmaps.Polyline(
        polylineId: const gmaps.PolylineId('route'),
        points: points.map(_g).toList(growable: false),
        color: widget.routeColor,
        width: 5,
        geodesic: true,
      ),
    };
  }

  Set<gmaps.Marker> _buildMarkers(List<LatLng> points, LatLng? driverLatLng) {
    final markers = <gmaps.Marker>{};
    final from = widget.route.fromLocation;
    final to = widget.route.toLocation;

    if (from != null && driverLatLng == null) {
      markers.add(
        gmaps.Marker(
          markerId: const gmaps.MarkerId('start'),
          position: gmaps.LatLng(from.latitude, from.longitude),
          icon: gmaps.BitmapDescriptor.defaultMarkerWithHue(
            gmaps.BitmapDescriptor.hueGreen,
          ),
          infoWindow: _emptyInfo,
          anchor: const Offset(0.5, 1.0),
          zIndexInt: 1,
        ),
      );
    }

    if (to != null) {
      markers.add(
        gmaps.Marker(
          markerId: const gmaps.MarkerId('end'),
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

    final orderedStops = [...widget.stops]
      ..sort((a, b) => a.sequenceNo.compareTo(b.sequenceNo));
    for (var i = 0; i < orderedStops.length; i++) {
      final stop = orderedStops[i];
      final isNext = i == widget.targetStopIndex;
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
          infoWindow: _emptyInfo,
          anchor: const Offset(0.5, 0.5),
          zIndexInt: isNext ? 3 : 1,
        ),
      );
    }

    if (driverLatLng != null) {
      final heading = resolveMarkerHeading(
        point: driverLatLng,
        routePoints: points,
        deviceHeading: widget.driverHeading,
      );
      markers.add(
        gmaps.Marker(
          markerId: const gmaps.MarkerId('driver'),
          position: _g(driverLatLng),
          icon: _navIcon ??
              gmaps.BitmapDescriptor.defaultMarkerWithHue(
                gmaps.BitmapDescriptor.hueAzure,
              ),
          infoWindow: _emptyInfo,
          rotation: heading,
          flat: true,
          anchor: const Offset(0.5, 0.5),
          zIndexInt: 10,
        ),
      );
    }

    return markers;
  }

  double _resolveHeading(LatLng driverLatLng, List<LatLng> points) {
    return resolveMarkerHeading(
      point: driverLatLng,
      routePoints: points,
      deviceHeading: widget.driverHeading,
    );
  }

  Future<void> _animateNavigationCamera() async {
    final controller = _controller;
    final driver = widget.driverPosition;
    if (controller == null || driver == null || _cameraBusy) return;

    final point = LatLng(driver.latitude, driver.longitude);
    final heading = _resolveHeading(point, _routePoints);

    _cameraBusy = true;
    try {
      await controller.animateCamera(
        gmaps.CameraUpdate.newCameraPosition(
          gmaps.CameraPosition(
            target: _g(point),
            zoom: widget.navigationZoom,
            bearing: heading,
            tilt: widget.cameraTilt,
          ),
        ),
      );
    } catch (_) {}
    finally {
      _cameraBusy = false;
    }
  }

  Future<void> _fitOverview() async {
    final controller = _controller;
    if (controller == null || _cameraBusy) return;

    final points = _routePoints;
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

    const minDelta = 0.004;
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
          56,
        ),
      );
    } catch (_) {}
    finally {
      _cameraBusy = false;
    }
  }

  void _onRecenter() {
    setState(() => _followEnabled = true);
    _animateNavigationCamera();
  }

  gmaps.LatLng _initialTarget() {
    final driver = widget.driverPosition;
    if (driver != null) {
      return gmaps.LatLng(driver.latitude, driver.longitude);
    }
    final points = _routePoints;
    if (points.isEmpty) return const gmaps.LatLng(24.7136, 46.6753);
    return _g(points.first);
  }

  @override
  Widget build(BuildContext context) {
    final mapId = TrddkMapStyle.cloudMapId;
    final mapStyle = TrddkMapStyle.nativeStyleJson;
    final navPadding = widget.followMode
        ? EdgeInsets.only(
            top: widget.followTopPadding,
            bottom: 200,
            left: 40,
            right: 40,
          )
        : EdgeInsets.zero;

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
              padding: navPadding,
              initialCameraPosition: gmaps.CameraPosition(
                target: _initialTarget(),
                zoom: widget.followMode ? widget.navigationZoom : 13,
                tilt: widget.followMode ? widget.cameraTilt : 0,
              ),
              markers: _markers,
              polylines: _polylines,
              myLocationEnabled: false,
              myLocationButtonEnabled: false,
              zoomControlsEnabled: false,
              mapToolbarEnabled: false,
              compassEnabled: false,
              onCameraMoveStarted: () {
                if (widget.followMode) {
                  setState(() => _followEnabled = false);
                }
              },
              onMapCreated: (controller) async {
                _controller = controller;
                await TrddkMapStyle.applyNativeStyle(controller)
                    .timeout(_revealTimeout, onTimeout: () => false);
                if (widget.followMode && widget.driverPosition != null) {
                  await _animateNavigationCamera()
                      .timeout(_revealTimeout, onTimeout: () {});
                } else {
                  await _fitOverview()
                      .timeout(_revealTimeout, onTimeout: () {});
                }
                _reveal();
              },
            ),
          ),
          if (widget.followMode && !_followEnabled)
            Positioned(
              right: 14,
              bottom: 14,
              child: Material(
                color: Colors.white,
                elevation: 4,
                borderRadius: BorderRadius.circular(24),
                child: InkWell(
                  onTap: _onRecenter,
                  borderRadius: BorderRadius.circular(24),
                  child: const Padding(
                    padding: EdgeInsets.all(10),
                    child: Icon(Icons.my_location_rounded, size: 22),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
