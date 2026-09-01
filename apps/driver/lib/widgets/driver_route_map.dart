import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:tardadi_core/tardadi_core.dart';

import '../ui/driver_map_config.dart';

class DriverRouteMap extends StatefulWidget {
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

  @override
  State<DriverRouteMap> createState() => _DriverRouteMapState();
}

class _DriverRouteMapState extends State<DriverRouteMap> {
  final _mapController = MapController();
  var _didInitialFit = false;

  @override
  void didUpdateWidget(covariant DriverRouteMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.followDriver && widget.driverPosition != null) {
      _followDriver();
      return;
    }
    if (!_didInitialFit ||
        oldWidget.targetStopIndex != widget.targetStopIndex) {
      _fitRoute();
    }
  }

  void _followDriver() {
    final driver = widget.driverPosition;
    if (driver == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _mapController.move(
        LatLng(driver.latitude, driver.longitude),
        math.max(_mapController.camera.zoom, 15),
      );
    });
  }

  void _fitRoute() {
    final points = _allPoints();
    final bounds = _boundsForPoints(points);
    if (bounds == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: bounds,
          padding: const EdgeInsets.fromLTRB(40, 64, 40, 180),
        ),
      );
      _didInitialFit = true;
    });
  }

  List<LatLng> _allPoints() {
    final routePoints = resolveRoutePoints(widget.route, widget.stops);
    final points = [...routePoints];
    final driver = widget.driverPosition;
    if (driver != null) {
      points.add(LatLng(driver.latitude, driver.longitude));
    }
    return points;
  }

  LatLngBounds? _boundsForPoints(List<LatLng> points) {
    if (points.isEmpty) return null;
    var minLat = points.first.latitude;
    var maxLat = points.first.latitude;
    var minLng = points.first.longitude;
    var maxLng = points.first.longitude;
    for (final point in points.skip(1)) {
      minLat = math.min(minLat, point.latitude);
      maxLat = math.max(maxLat, point.latitude);
      minLng = math.min(minLng, point.longitude);
      maxLng = math.max(maxLng, point.longitude);
    }
    return LatLngBounds(
      LatLng(minLat, minLng),
      LatLng(maxLat, maxLng),
    );
  }

  List<Polyline> _googleStyleLine({
    required List<LatLng> points,
    required Color color,
    bool dashed = false,
  }) {
    if (points.length < 2) return [];
    return [
      Polyline(
        points: points,
        color: color.withValues(alpha: 0.35),
        strokeWidth: 9,
        strokeCap: StrokeCap.round,
        strokeJoin: StrokeJoin.round,
      ),
      Polyline(
        points: points,
        color: color,
        strokeWidth: 5.5,
        strokeCap: StrokeCap.round,
        strokeJoin: StrokeJoin.round,
        pattern: dashed
            ? StrokePattern.dashed(segments: [14, 10])
            : const StrokePattern.solid(),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    if (TrddkGoogleMapsConfig.isConfigured) {
      return TrddkGoogleRouteMap(
        route: widget.route,
        stops: widget.stops,
        routeColor: widget.routeColor,
        driverPosition: widget.driverPosition,
        driverHeading: widget.driverHeading,
        followDriver: widget.followDriver,
        borderRadius: 0,
        padding: widget.followDriver ? 80 : 48,
      );
    }

    final routePoints = resolveRoutePoints(widget.route, widget.stops);
    final driverLatLng = widget.driverPosition == null
        ? null
        : LatLng(
            widget.driverPosition!.latitude,
            widget.driverPosition!.longitude,
          );

    const onRouteThresholdMeters = 80.0;
    final onRoute = driverLatLng == null ||
        routePoints.isEmpty ||
        distanceToRouteMeters(routePoints, driverLatLng) <=
            onRouteThresholdMeters;

    final splitIndex = !onRoute || driverLatLng == null || routePoints.isEmpty
        ? 0
        : nearestPointIndex(routePoints, driverLatLng);

    final completed = onRoute
        ? routePoints.take(splitIndex + 1).toList()
        : <LatLng>[];
    if (onRoute &&
        driverLatLng != null &&
        (completed.isEmpty ||
            completed.last.latitude != driverLatLng.latitude ||
            completed.last.longitude != driverLatLng.longitude)) {
      completed.add(driverLatLng);
    }

    final remaining = onRoute
        ? <LatLng>[
            if (driverLatLng != null) driverLatLng,
            ...routePoints.skip(splitIndex + 1),
          ]
        : routePoints;

    final initialCenter = routePoints.isNotEmpty
        ? routePoints.first
        : (driverLatLng ?? const LatLng(24.7136, 46.6753));

    final polylines = <Polyline>[
      ..._googleStyleLine(
        points: routePoints,
        color: widget.routeColor.withValues(alpha: 0.45),
      ),
      if (onRoute) ...[
        ..._googleStyleLine(points: completed, color: widget.routeColor),
        ..._googleStyleLine(
          points: remaining,
          color: widget.routeColor.withValues(alpha: 0.72),
          dashed: true,
        ),
      ],
    ];

    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: initialCenter,
        initialZoom: 14,
        backgroundColor: TrddkMapColors.navy,
        interactionOptions: const InteractionOptions(
          flags: InteractiveFlag.pinchZoom | InteractiveFlag.drag,
        ),
        onMapReady: _fitRoute,
      ),
      children: [
        TileLayer(
          urlTemplate: DriverMapConfig.tilesUrl,
          subdomains: DriverMapConfig.tileSubdomains,
          userAgentPackageName: 'com.tardadi.tardadiDriver',
        ),
        if (polylines.isNotEmpty) PolylineLayer(polylines: polylines),
        MarkerLayer(
          markers: [
            ..._routeMarkers(routePoints),
            if (driverLatLng != null) _driverMarker(driverLatLng),
          ],
        ),
      ],
    );
  }

  List<Marker> _routeMarkers(List<LatLng> routePoints) {
    final markers = <Marker>[];
    final from = widget.route.fromLocation;
    final to = widget.route.toLocation;

    if (routePoints.length >= 2) {
      markers.add(_startDirectionMarker(routePoints));
    }

    if (from != null) {
      markers.add(
        _pinMarker(
          LatLng(from.latitude, from.longitude),
          DriverMapConfig.startGreen,
        ),
      );
    }
    if (to != null) {
      markers.add(
        _pinMarker(
          LatLng(to.latitude, to.longitude),
          DriverMapConfig.endRed,
        ),
      );
    }

    for (final stop in widget.stops) {
      markers.add(
        _pinMarker(
          LatLng(stop.latitude, stop.longitude),
          widget.routeColor,
          label: '${stop.sequenceNo}',
        ),
      );
    }

    return markers;
  }

  Marker _startDirectionMarker(List<LatLng> routePoints) {
    final start = routePoints.first;
    final next = routePoints.length > 1 ? routePoints[1] : start;
    final bearing = headingBetween(
      fromLat: start.latitude,
      fromLng: start.longitude,
      toLat: next.latitude,
      toLng: next.longitude,
    );

    return Marker(
      point: start,
      width: 34,
      height: 34,
      alignment: Alignment.center,
      child: Transform.rotate(
        angle: (bearing - 45) * math.pi / 180,
        child: Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            color: DriverMapConfig.startGreen,
            borderRadius: BorderRadius.circular(8),
            boxShadow: const [
              BoxShadow(
                color: Color(0x66000000),
                blurRadius: 6,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: const Icon(
            Icons.navigation_rounded,
            color: Colors.white,
            size: 18,
          ),
        ),
      ),
    );
  }

  Marker _pinMarker(LatLng point, Color color, {String? label}) {
    return Marker(
      point: point,
      width: 24,
      height: 24,
      alignment: Alignment.center,
      child: label == null
          ? Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 3),
              ),
            )
          : Container(
              width: 22,
              height: 22,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: color, width: 2.5),
              ),
              child: Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  height: 1,
                ),
              ),
            ),
    );
  }

  Marker _driverMarker(LatLng point) {
    final heading = widget.driverHeading ?? 0;
    return Marker(
      point: point,
      width: 44,
      height: 44,
      alignment: Alignment.center,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: const Color(0xFF4285F4).withValues(alpha: 0.18),
              shape: BoxShape.circle,
            ),
          ),
          Transform.rotate(
            angle: heading * math.pi / 180,
            child: Container(
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                color: const Color(0xFF4285F4),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 3),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
