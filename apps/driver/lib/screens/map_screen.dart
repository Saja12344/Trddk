import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart' show LatLng;
import 'package:tardadi_core/tardadi_core.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../l10n/app_localizations.dart';
import '../models/crowd_level.dart';
import '../services/driver_api.dart';
import '../services/driver_navigation.dart';
import '../services/driver_prefs.dart';
import '../services/session_store.dart';
import '../ui/driver_design.dart';
import '../ui/driver_map_config.dart';
import '../ui/platform_ui.dart';
import '../utils/arabic_display.dart';
import '../widgets/driver_route_map.dart';
import '../widgets/navigation_banner.dart';
import '../widgets/trip_options_panel.dart';
import 'login_screen.dart' show isDriverStoreReviewPhone;
import 'settings_screen.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen>
    with SingleTickerProviderStateMixin {
  static const _startThresholdMeters = 1500.0;
  static const _enforceStartDistance = true;

  late final AnimationController _radarController;
  Timer? _gpsTimer;
  Timer? _distanceTimer;
  var _distanceRefreshInFlight = false;
  LocationPermission? _locationPermission;
  bool _tripActive = false;
  var _autoCloseDialogOpen = false;
  bool _tripPanelOpen = false;
  bool _etaSheetExpanded = false;
  bool _onBreak = false;
  double _distanceKm = 40;
  double _offRouteMeters = 0;
  /// Distance to the route's start point; unknown until GPS is read.
  double _startMeters = double.infinity;
  String _selectedVehicle = 'Bus';
  String _lastGps = '--';
  CrowdLevel _crowdLevel = CrowdLevel.medium;
  int _targetStopIndex = 0;
  bool _returnLeg = false;
  Position? _driverPosition;
  final _voice = NavVoiceGuide();
  final _rerouteGate = NavRerouteGate();
  DriverNavigationRoute? _navRoute;
  int? _navEtaSeconds;
  var _navMuted = false;
  var _voiceNotice = false;
  var _voiceNoticeRecorded = false;
  var _navRequestId = 0;

  DriverSession get _session => SessionStore.instance.session!;

  TardadiApi get _api => createDriverApi(
        organizationId: _session.driver.businessId,
        authToken: _session.sessionToken,
      );

  List<StopModel> get _orderedStops {
    final stops = [..._session.stops];
    stops.sort((a, b) => a.sequenceNo.compareTo(b.sequenceNo));
    return stops;
  }

  StopModel? get _targetStop =>
      _targetStopIndex < _orderedStops.length ? _orderedStops[_targetStopIndex] : null;

  GeoPoint? get _activeTarget {
    final stop = _targetStop;
    if (stop != null) {
      return GeoPoint(latitude: stop.latitude, longitude: stop.longitude);
    }
    final end = _session.route.toLocation;
    if (end != null) {
      return GeoPoint(latitude: end.latitude, longitude: end.longitude);
    }
    return null;
  }

  GeoPoint? get _driverGeoPoint => _driverPosition == null
      ? null
      : GeoPoint(
          latitude: _driverPosition!.latitude,
          longitude: _driverPosition!.longitude,
        );

  String _tripTitle(BuildContext context) {
    final routeName = _session.route.name.trim();
    if (routeName.isNotEmpty) {
      return context.displayPlaceName(
        routeName,
        nameAr: _session.route.nameAr,
        nameEn: _session.route.nameEn,
      );
    }
    return context.displayPlaceName(
      _session.bus.label,
      nameAr: _session.bus.labelAr,
      nameEn: _session.bus.labelEn,
    );
  }

  Color get _routeColor => _colorFromHex(_session.route.colorHex);

  int get _etaMinutes {
    final navSeconds = _navEtaSeconds;
    if (_tripActive && navSeconds != null && navSeconds > 0) {
      return (navSeconds / 60).ceil().clamp(1, 99);
    }
    final target = _activeTarget;
    final position = _driverPosition;
    if (target == null) return 0;
    if (position == null) return 5;
    final meters = Geolocator.distanceBetween(
      position.latitude,
      position.longitude,
      target.latitude,
      target.longitude,
    );
    final minutes = (meters / 1000) / 22 * 60;
    return minutes.clamp(1, 99).round();
  }

  bool get _isOffRoute => _offRouteMeters > 80;

  /// App Store / Play reviewers are never near the route, so their demo
  /// account skips the distance check.
  bool get _isReviewSession => isDriverStoreReviewPhone(_session.driver.phone);

  bool get _canStart =>
      !_enforceStartDistance ||
      _isReviewSession ||
      _startMeters <= _startThresholdMeters;

  @override
  void initState() {
    super.initState();
    _selectedVehicle = SessionStore.instance.selectedVehicle ?? 'Bus';
    _voice.onUnavailable = _noteVoiceUnavailable;
    unawaited(_loadNavMute());
    _radarController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
    unawaited(_refreshRouteDetail());
    _refreshDistance();
    _distanceTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => _refreshDistance(),
    );
  }

  @override
  void dispose() {
    _radarController.dispose();
    _gpsTimer?.cancel();
    _distanceTimer?.cancel();
    unawaited(_voice.dispose());
    unawaited(_setTripAwake(false));
    super.dispose();
  }

  bool _routeNamesAreTranslated(RouteModel route) {
    bool hasBoth(String? ar, String? en) =>
        (ar?.trim().isNotEmpty ?? false) && (en?.trim().isNotEmpty ?? false);
    bool placeReady(LocationPlace? place) =>
        place == null || hasBoth(place.addressAr, place.addressEn);
    return hasBoth(route.nameAr, route.nameEn) &&
        placeReady(route.fromLocation) &&
        placeReady(route.toLocation);
  }

  Future<void> _refreshRouteDetail() async {
    final session = SessionStore.instance.session;
    if (session == null) return;
    if (session.route.polyline?.isNotEmpty == true &&
        session.route.fromLocation != null &&
        _routeNamesAreTranslated(session.route)) {
      return;
    }

    try {
      final detail = await _api.getRoute(session.route.routeId);
      SessionStore.instance.updateRoute(detail.route, detail.stops);
      if (mounted) setState(() {});
    } catch (_) {
      // Keep session route when refresh fails.
    }
  }

  Future<void> _refreshDistance() async {
    if (_distanceRefreshInFlight) return;
    _distanceRefreshInFlight = true;
    try {
      final session = SessionStore.instance.session;
      if (session == null) return;

      _locationPermission ??= await Geolocator.checkPermission();
      if (_locationPermission == LocationPermission.denied) {
        _locationPermission = await Geolocator.requestPermission();
      }
      if (_locationPermission == LocationPermission.denied ||
          _locationPermission == LocationPermission.deniedForever) {
        return;
      }

      final position = await _resolveDriverPosition();
      final target = _activeTarget;
      if (target == null) return;
      final meters = Geolocator.distanceBetween(
        position.latitude,
        position.longitude,
        target.latitude,
        target.longitude,
      );
      final start = resolveRouteStart(_session.route, _orderedStops);
      final startMeters = start == null
          ? meters
          : Geolocator.distanceBetween(
              position.latitude,
              position.longitude,
              start.latitude,
              start.longitude,
            );
      if (mounted) {
        setState(() {
          _driverPosition = position;
          _distanceKm = (meters / 1000).clamp(0.0, 999);
          _startMeters = startMeters;
          _offRouteMeters = _measureOffRoute(position);
        });
        _onNavigationTick(position);
      }
    } catch (_) {
      // Keep the designed default distance when location is unavailable.
    } finally {
      _distanceRefreshInFlight = false;
    }
  }

  double _measureOffRoute(Position position) {
    final routePoints = resolveRoutePoints(_session.route, _orderedStops);
    if (routePoints.isEmpty) return 0;
    return distanceToRouteMeters(
      routePoints,
      LatLng(position.latitude, position.longitude),
    );
  }

  static const _simulatorSnapThresholdMeters = 500.0;

  Future<Position> _resolveDriverPosition() async {
    final lastKnown = await Geolocator.getLastKnownPosition();
    try {
      final gps = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          timeLimit: Duration(seconds: 8),
        ),
      );
      return _maybeSnapToRoute(gps);
    } catch (_) {
      if (lastKnown != null) return _maybeSnapToRoute(lastKnown);
      rethrow;
    }
  }

  Position _maybeSnapToRoute(Position gps) {
    if (!kDebugMode) return gps;

    final routePoints = resolveRoutePoints(_session.route, _orderedStops);
    if (routePoints.isEmpty) return gps;

    final offRoute = distanceToRouteMeters(
      routePoints,
      LatLng(gps.latitude, gps.longitude),
    );
    if (offRoute <= _simulatorSnapThresholdMeters) return gps;

    final start = resolveRouteStart(_session.route, _orderedStops);
    if (start == null) return gps;

    return Position(
      latitude: start.latitude,
      longitude: start.longitude,
      timestamp: DateTime.now(),
      accuracy: gps.accuracy,
      altitude: gps.altitude,
      altitudeAccuracy: gps.altitudeAccuracy,
      heading: gps.heading,
      headingAccuracy: gps.headingAccuracy,
      speed: gps.speed,
      speedAccuracy: gps.speedAccuracy,
    );
  }

  Future<void> _startTrip() async {
    if (_enforceStartDistance) {
      await _refreshDistance();
    }
    if (!mounted) return;
    if (!_canStart) {
      final l10n = context.l10n;
      _showError(
        l10n.cannotStartTrip(
          _formatDistance(
            context,
            _startMeters.isFinite ? (_startMeters / 1000).clamp(0.0, 999) : _distanceKm,
          ),
        ),
      );
      return;
    }

    try {
      final existingTripId = SessionStore.instance.session?.tripId;
      var resumeExisting = false;
      if (existingTripId != null && existingTripId.isNotEmpty) {
        if (!mounted) return;
        final choice = await _askAboutOpenTrip();
        if (!mounted || choice == null) return;
        resumeExisting = choice == _OpenTripChoice.resume;
        if (!resumeExisting) {
          try {
            await _api.endTrip(
              tripId: existingTripId,
              driverId: _session.driver.driverId,
            );
          } catch (_) {}
          SessionStore.instance.updateTripId(null);
        }
      }
      final tripId = resumeExisting
          ? existingTripId!
          : await _api.startTrip(
              driverId: _session.driver.driverId,
              busId: _session.bus.busId,
              routeId: _session.route.routeId,
            );
      if (!resumeExisting) {
        SessionStore.instance.updateTripId(tripId);
      }
      await _refreshDistance();
      setState(() {
        _tripActive = true;
        _tripPanelOpen = false;
        _onBreak = false;
        _targetStopIndex = 0;
        _returnLeg = false;
        _etaSheetExpanded = false;
        _navRoute = null;
        _navEtaSeconds = null;
        _voiceNotice = false;
      });
      _rerouteGate.reset();
      unawaited(_setTripAwake(true));
      unawaited(_prepareNavVoice());
      unawaited(_loadNavigationRoute());
      await _startGps(tripId);
    } catch (error) {
      _showError(error.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _endTrip() async {
    final tripId = SessionStore.instance.session?.tripId;
    if (tripId == null) return;

    try {
      await _api.endTrip(tripId: tripId, driverId: _session.driver.driverId);
      _gpsTimer?.cancel();
      SessionStore.instance.updateTripId(null);
      _navRequestId++;
      _rerouteGate.reset();
      unawaited(_voice.stop());
      unawaited(_setTripAwake(false));
      setState(() {
        _tripActive = false;
        _tripPanelOpen = false;
        _onBreak = false;
        _lastGps = '--';
        _targetStopIndex = 0;
        _returnLeg = false;
        _etaSheetExpanded = false;
        _navRoute = null;
        _navEtaSeconds = null;
        _voiceNotice = false;
      });
    } catch (error) {
      _showError(error.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _startGps(String tripId) async {
    _locationPermission ??= await Geolocator.checkPermission();
    if (_locationPermission == LocationPermission.denied) {
      _locationPermission = await Geolocator.requestPermission();
    }
    if (_locationPermission == LocationPermission.denied ||
        _locationPermission == LocationPermission.deniedForever) {
      _showError('يجب السماح بالموقع لإرسال موقع الباص');
      return;
    }

    _gpsTimer?.cancel();
    var gpsInFlight = false;
    _gpsTimer = Timer.periodic(const Duration(seconds: 2), (_) async {
      if (gpsInFlight || _onBreak) return;
      gpsInFlight = true;
      try {
        final position = await _resolveDriverPosition();
        await _api.sendGps(
          tripId: tripId,
          driverId: _session.driver.driverId,
          busId: _session.bus.busId,
          latitude: position.latitude,
          longitude: position.longitude,
          speedKmh: position.speed * 3.6,
          heading: position.heading,
          crowdLevel: _crowdLevel.name,
        );
        if (mounted) {
          final target = _activeTarget;
          if (target == null) return;
          final meters = Geolocator.distanceBetween(
            position.latitude,
            position.longitude,
            target.latitude,
            target.longitude,
          );
          setState(() {
            _driverPosition = position;
            _distanceKm = (meters / 1000).clamp(0.0, 999);
            _lastGps = TimeOfDay.now().format(context);
            _offRouteMeters = _measureOffRoute(position);
          });
          _onNavigationTick(position);
        }
      } catch (error) {
        final message = error.toString();
        if (message.contains('TRIP_AUTO_CLOSED')) {
          unawaited(_handleAutoClosedTrip());
        } else if (message.contains('Trip is not active')) {
          _gpsTimer?.cancel();
          SessionStore.instance.updateTripId(null);
          unawaited(_setTripAwake(false));
          if (mounted) {
            setState(() {
              _tripActive = false;
              _onBreak = false;
            });
          }
        }
      } finally {
        gpsInFlight = false;
      }
    });
  }

  Future<_OpenTripChoice?> _askAboutOpenTrip() {
    final l10n = context.l10n;
    return showDialog<_OpenTripChoice>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.openTripTitle),
        content: Text(l10n.openTripMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(_OpenTripChoice.resume),
            child: Text(l10n.continueOpenTrip),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(_OpenTripChoice.restart),
            child: Text(l10n.startFreshTrip),
          ),
        ],
      ),
    );
  }

  Future<void> _handleAutoClosedTrip() async {
    if (_autoCloseDialogOpen) return;
    _autoCloseDialogOpen = true;
    _gpsTimer?.cancel();
    SessionStore.instance.updateTripId(null);
    unawaited(_setTripAwake(false));
    unawaited(_voice.stop());
    if (!mounted) return;
    setState(() {
      _tripActive = false;
      _onBreak = false;
      _tripPanelOpen = false;
    });
    final l10n = context.l10n;
    final startNew = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        content: Text(l10n.tripAutoClosed),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.startNewTrip),
          ),
        ],
      ),
    );
    _autoCloseDialogOpen = false;
    if (startNew == true && mounted) {
      await _startTrip();
    }
  }

  void _showError(String message) {
    DriverSnack.show(context, message);
  }

  void _openSettings() {
    Navigator.of(context).push(
      driverRoute(
        beginOffset: const Offset(0.12, 0),
        builder: (_) => SettingsScreen(
          session: _session,
          selectedVehicle: _selectedVehicle,
          onVehicleChanged: (vehicle) {
            setState(() => _selectedVehicle = vehicle);
            SessionStore.instance.setVehicle(vehicle);
            final driverKey = DriverPrefs.driverKey(
              phone: _session.driver.phone,
              driverId: _session.driver.driverId,
            );
            unawaited(
              DriverPrefs.instance.saveVehicleSetup(
                driverKey: driverKey,
                vehicle: vehicle,
              ),
            );
          },
          onLogout: () {
            _gpsTimer?.cancel();
            SessionStore.instance.clear();
            Navigator.of(context).pushNamedAndRemoveUntil('/login', (_) => false);
          },
        ),
      ),
    );
  }

  Future<void> _confirmEndTrip() async {
    final l10n = context.l10n;
    final confirmed = await showPlatformConfirmDialog(
      context,
      title: l10n.endTripTitle,
      message: l10n.endTripMessage,
      cancelLabel: l10n.cancel,
      confirmLabel: l10n.endTrip,
      isDestructive: true,
    );
    if (confirmed) {
      await _endTrip();
    }
  }

  void _toggleTripPanel() {
    setState(() {
      _tripPanelOpen = !_tripPanelOpen;
      if (_tripPanelOpen) _etaSheetExpanded = false;
    });
  }

  void _toggleEtaSheet() {
    if (_tripPanelOpen) return;
    setState(() => _etaSheetExpanded = !_etaSheetExpanded);
  }

  Future<void> _toggleBreak() async {
    final tripId = _session.tripId;
    if (tripId == null) return;

    final next = !_onBreak;
    setState(() => _onBreak = next);
    try {
      await _api.setTripBreak(
        tripId: tripId,
        driverId: _session.driver.driverId,
        onBreak: next,
      );
    } catch (_) {
      try {
        final position = await _resolveDriverPosition();
        await _api.sendGps(
          tripId: tripId,
          driverId: _session.driver.driverId,
          busId: _session.bus.busId,
          latitude: position.latitude,
          longitude: position.longitude,
          speedKmh: position.speed * 3.6,
          heading: position.heading,
          crowdLevel: next ? 'on_break' : _crowdLevel.name,
          onBreak: next,
        );
      } catch (error) {
        if (!mounted) return;
        setState(() => _onBreak = !next);
        _showError(error.toString().replaceFirst('Exception: ', ''));
      }
    }
  }

  Future<void> _markArrived() async {
    final tripId = _session.tripId;
    if (tripId != null) {
      final stop = _targetStop;
      try {
        await _api.markTripArrived(
          tripId: tripId,
          driverId: _session.driver.driverId,
          stopId: stop?.stopId,
        );
      } catch (_) {}
    }

    final reversedRoute = reverseRouteModel(_session.route);
    final reversedStops = reverseStops(_orderedStops);
    SessionStore.instance.updateRoute(reversedRoute, reversedStops);
    setState(() {
      _returnLeg = !_returnLeg;
      _targetStopIndex = 0;
      _etaSheetExpanded = true;
    });
    await _refreshDistance();
    unawaited(_loadNavigationRoute());
  }

  Future<void> _loadNavMute() async {
    final muted = await DriverPrefs.instance.isNavVoiceMuted();
    if (!mounted) return;
    setState(() => _navMuted = muted);
  }

  Future<void> _setTripAwake(bool awake) async {
    try {
      if (awake) {
        await WakelockPlus.enable();
      } else {
        await WakelockPlus.disable();
      }
    } catch (_) {}
  }

  String get _navLanguage => context.l10n.isArabic ? 'ar' : 'en';

  Future<void> _prepareNavVoice() async {
    if (!mounted) return;
    await _voice.prepare(_navLanguage);
  }

  void _noteVoiceUnavailable() {
    unawaited(_showVoiceNoticeOnce());
  }

  Future<void> _showVoiceNoticeOnce() async {
    if (!mounted || _voiceNotice) return;
    final language = _navLanguage;
    final seen = await DriverPrefs.instance.hasSeenNavVoiceNotice(language);
    if (!mounted || seen) return;
    setState(() => _voiceNotice = true);
    _recordVoiceNotice();
  }

  void _recordVoiceNotice() {
    if (!_voiceNotice || _navCue == null || _voiceNoticeRecorded) return;
    _voiceNoticeRecorded = true;
    unawaited(DriverPrefs.instance.markNavVoiceNoticeSeen(_navLanguage));
  }

  void _dismissVoiceNotice() {
    setState(() => _voiceNotice = false);
    _voiceNoticeRecorded = true;
    unawaited(DriverPrefs.instance.markNavVoiceNoticeSeen(_navLanguage));
  }

  Future<void> _toggleNavMute() async {
    final next = !_navMuted;
    setState(() => _navMuted = next);
    await DriverPrefs.instance.setNavVoiceMuted(next);
    if (next) await _voice.stop();
  }

  double? _usableHeading(Position position) {
    final heading = position.heading;
    if (heading.isNaN || heading < 0 || heading >= 360) return null;
    return heading;
  }

  ({GeoPoint destination, List<GeoPoint> waypoints})? _navigationTargets() {
    final remaining = _orderedStops.skip(_targetStopIndex).toList();
    final to = _session.route.toLocation;
    if (to != null) {
      final destination = GeoPoint(
        latitude: to.latitude,
        longitude: to.longitude,
      );
      final waypoints = <GeoPoint>[
        for (final stop in remaining)
          if ((stop.latitude - destination.latitude).abs() > 1e-5 ||
              (stop.longitude - destination.longitude).abs() > 1e-5)
            GeoPoint(latitude: stop.latitude, longitude: stop.longitude),
      ];
      return (destination: destination, waypoints: waypoints);
    }
    if (remaining.isEmpty) return null;
    final last = remaining.last;
    return (
      destination: GeoPoint(
        latitude: last.latitude,
        longitude: last.longitude,
      ),
      waypoints: [
        for (final stop in remaining.take(remaining.length - 1))
          GeoPoint(latitude: stop.latitude, longitude: stop.longitude),
      ],
    );
  }

  List<LatLng>? get _navigationPolyline {
    final route = _navRoute;
    if (!_tripActive || route == null || route.points.length < 2) return null;
    return navigationLine(route);
  }

  NavManeuverCue? get _navCue {
    final route = _navRoute;
    final position = _driverPosition;
    if (route == null || position == null) return null;
    return nextManeuver(
      route,
      LatLng(position.latitude, position.longitude),
    );
  }

  Future<void> _loadNavigationRoute() async {
    if (!_tripActive || !mounted) return;
    final position = _driverPosition;
    final targets = _navigationTargets();
    if (position == null || targets == null) {
      if (mounted) {
        setState(() {
          _navRoute = null;
          _navEtaSeconds = null;
        });
      }
      return;
    }

    final requestId = ++_navRequestId;
    final language = _navLanguage;
    try {
      final route = await _api.fetchDriverNavigation(
        origin: GeoPoint(
          latitude: position.latitude,
          longitude: position.longitude,
        ),
        heading: _usableHeading(position),
        waypoints: targets.waypoints,
        destination: targets.destination,
        language: language,
      );
      if (!mounted || requestId != _navRequestId || !_tripActive) return;
      if (route.points.length < 2) {
        setState(() {
          _navRoute = null;
          _navEtaSeconds = null;
        });
        return;
      }
      _voice.resetAnnouncements();
      _rerouteGate.noteRouteUpdated();
      setState(() {
        _navRoute = route;
        _navEtaSeconds = route.durationSeconds;
      });
      _recordVoiceNotice();
      _onNavigationTick(position);
    } catch (_) {
      if (!mounted || requestId != _navRequestId || !_tripActive) return;
      setState(() {
        _navRoute = null;
        _navEtaSeconds = null;
      });
    }
  }

  void _onNavigationTick(Position position) {
    final route = _navRoute;
    if (!_tripActive || _onBreak || route == null) return;
    final here = LatLng(position.latitude, position.longitude);
    final cue = nextManeuver(route, here);
    if (cue != null && cue.instruction.isNotEmpty) {
      unawaited(
        _voice.announce(
          stepKey: '${cue.stepIndex}:${cue.instruction}',
          distanceMeters: cue.distanceMeters,
          text: cue.instruction,
          muted: _navMuted,
        ),
      );
    }
    final offRoute = distanceToPolylineMeters(navigationLine(route), here);
    if (_rerouteGate.shouldReroute(
      distanceMeters: offRoute,
      now: DateTime.now(),
    )) {
      unawaited(_loadNavigationRoute());
    }
  }

  Widget _buildIdleScaffold(DriverSession session) {
    final l10n = context.l10n;
    return DriverChrome(
      child: Column(
        children: [
          Container(
            color: DriverColors.navyPanel,
            padding: EdgeInsets.fromLTRB(
              42,
              MediaQuery.paddingOf(context).top + 34,
              28,
              18,
            ),
            child: Row(
              children: [
                ColorFiltered(
                  colorFilter: const ColorFilter.mode(
                    Colors.white,
                    BlendMode.srcIn,
                  ),
                  child: Image.asset(
                    DriverAssets.mark,
                    width: 30,
                    height: 30,
                    fit: BoxFit.contain,
                  ),
                ),
                const Spacer(),
                Text(
                  l10n.tardadi,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 30,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.2,
                  ),
                ),
                const Spacer(),
                IconButton(
                  onPressed: _openSettings,
                  icon: const Icon(
                    Icons.menu_rounded,
                    color: Colors.white,
                    size: 34,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                16,
                20,
                12 + MediaQuery.paddingOf(context).bottom,
              ),
              child: Column(
                children: [
                  Expanded(
                    flex: 5,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: DriverRouteMap(
                        route: session.route,
                        stops: _orderedStops,
                        routeColor: _routeColor,
                        targetStopIndex: 0,
                        driverPosition: _driverGeoPoint,
                        driverHeading: _driverPosition?.heading,
                        followDriver: false,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Expanded(
                    flex: 4,
                    child: _RouteStopsPreview(
                      route: session.route,
                      stops: _orderedStops,
                    ),
                  ),
                  const SizedBox(height: 14),
                  _StatusPill(canStart: _canStart),
                  const SizedBox(height: 14),
                  DriverButton(
                    label: l10n.start,
                    onPressed: _canStart ? _startTrip : null,
                    color: DriverColors.orange,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    l10n.lastGps(
                      gps: _lastGps,
                      route: context.displayPlaceName(
                        session.route.name,
                        nameAr: session.route.nameAr,
                        nameEn: session.route.nameEn,
                      ),
                      vehicle: l10n.vehicleLabel(_selectedVehicle),
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.48),
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveTripScaffold() {
    final l10n = context.l10n;
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return DriverChrome(
      bodyColor: DriverColors.navyDeep,
      child: Column(
        children: [
          Container(
            color: DriverColors.navyPanel,
            padding: EdgeInsets.fromLTRB(
              28,
              MediaQuery.paddingOf(context).top + 22,
              28,
              18,
            ),
            child: Row(
              children: [
                ColorFiltered(
                  colorFilter: const ColorFilter.mode(
                    Colors.white,
                    BlendMode.srcIn,
                  ),
                  child: Image.asset(
                    DriverAssets.mark,
                    width: 28,
                    height: 28,
                    fit: BoxFit.contain,
                  ),
                ),
                const SizedBox(width: 18),
                Expanded(
                  child: Text(
                    _tripTitle(context),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 28),
              ],
            ),
          ),
          Expanded(
            child: Stack(
              children: [
                if (!_tripPanelOpen)
                  Positioned.fill(
                    child: ColoredBox(
                      color: DriverColors.navyDeep,
                      child: DriverRouteMap(
                        route: _session.route,
                        stops: _orderedStops,
                        routeColor: _routeColor,
                        targetStopIndex: _targetStopIndex,
                        driverPosition: _driverGeoPoint,
                        driverHeading: _driverPosition?.heading,
                        followDriver: _tripActive && !_onBreak,
                        navigationPolyline: _navigationPolyline,
                        trimTraveled: _navigationPolyline != null,
                        followTopPadding: _navCue == null ? 64 : 168,
                      ),
                    ),
                  ),
                if (_navCue != null && !_tripPanelOpen)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: NavigationBanner(
                      cue: _navCue!,
                      muted: _navMuted,
                      showVoiceNotice: _voiceNotice,
                      onMuteToggle: () => unawaited(_toggleNavMute()),
                      onDismissVoiceNotice: _dismissVoiceNotice,
                    ),
                  ),
                if (_isOffRoute && !_tripPanelOpen && _navRoute == null)
                  Positioned(
                    top: 12,
                    left: 16,
                    right: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: DriverColors.orange,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        l10n.offRoute,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                DriverLeftSlidePanel(
                  visible: _tripPanelOpen,
                  onClose: _toggleTripPanel,
                  child: TripOptionsPanel(
                    crowdLevel: _crowdLevel,
                    onCrowdLevelChanged: (level) =>
                        setState(() => _crowdLevel = level),
                    onEndTrip: _confirmEndTrip,
                    onBreak: _toggleBreak,
                    onBreakLabel:
                        _onBreak ? l10n.resumeTrip : l10n.takeABreak,
                  ),
                ),
              ],
            ),
          ),
          if (!_tripPanelOpen)
            _TripSummarySheet(
              etaMinutes: _etaMinutes,
              expanded: _etaSheetExpanded,
              bottomInset: bottomInset,
              onBreak: _onBreak,
              onSheetTap: _toggleEtaSheet,
              onPanelTap: _toggleTripPanel,
              onArrived: _markArrived,
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = SessionStore.instance.session;
    if (session == null) {
      return const Scaffold(body: Center(child: Text('لا توجد جلسة')));
    }

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 380),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      transitionBuilder: (child, animation) {
        final offset = Tween<Offset>(
          begin: const Offset(0, 0.06),
          end: Offset.zero,
        ).animate(animation);
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(position: offset, child: child),
        );
      },
      child: _tripActive
          ? KeyedSubtree(
              key: const ValueKey('active-trip'),
              child: _buildActiveTripScaffold(),
            )
          : KeyedSubtree(
              key: const ValueKey('idle-trip'),
              child: _buildIdleScaffold(session),
            ),
    );
  }
}

enum _OpenTripChoice { resume, restart }

String _formatDistance(BuildContext context, double kilometers) {
  return context.l10n.formatDistanceKm(kilometers);
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.canStart});

  final bool canStart;

  @override
  Widget build(BuildContext context) {
    final accent = canStart ? DriverColors.green : DriverColors.orange;
    return Align(
      alignment: Alignment.center,
      child: Container(
        constraints: const BoxConstraints(minWidth: 244, minHeight: 40),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: accent.withValues(alpha: 0.45)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              canStart ? Icons.check_circle_rounded : Icons.place_rounded,
              size: 18,
              color: accent,
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                canStart
                    ? context.l10n.youCanStart
                    : context.l10n.goCloserToStart,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Color _colorFromHex(String value) {
  final normalized = value.replaceAll('#', '').trim();
  if (normalized.length == 6) {
    return Color(int.parse('FF$normalized', radix: 16));
  }
  if (normalized.length == 8) {
    return Color(int.parse(normalized, radix: 16));
  }
  return DriverColors.orange;
}

class _TripSummarySheet extends StatelessWidget {
  const _TripSummarySheet({
    required this.etaMinutes,
    required this.expanded,
    required this.bottomInset,
    required this.onBreak,
    required this.onSheetTap,
    required this.onPanelTap,
    required this.onArrived,
  });

  final int etaMinutes;
  final bool expanded;
  final double bottomInset;
  final bool onBreak;
  final VoidCallback onSheetTap;
  final VoidCallback onPanelTap;
  final VoidCallback onArrived;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final title = onBreak ? l10n.onBreak : l10n.minutesEta(etaMinutes);
    final subtitle =
        onBreak ? l10n.tripPaused : l10n.estimatedArrival;

    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: DriverColors.navyDeep,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: AnimatedSize(
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOutCubic,
        child: Padding(
          padding: EdgeInsets.fromLTRB(22, 10, 22, 18 + bottomInset),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              GestureDetector(
                onTap: onSheetTap,
                behavior: HitTestBehavior.opaque,
                child: Row(
                  children: [
                    IconButton(
                      onPressed: onPanelTap,
                      icon: const Icon(
                        Icons.segment_rounded,
                        color: Colors.white,
                        size: 30,
                      ),
                    ),
                    Expanded(
                      child: Column(
                        children: [
                          Text(
                            title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 20,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            subtitle,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 48),
                  ],
                ),
              ),
              if (expanded && !onBreak) ...[
                const SizedBox(height: 10),
                Divider(color: Colors.white.withValues(alpha: 0.3), height: 1),
                const SizedBox(height: 18),
                _SwipeArrivedButton(onCompleted: onArrived),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SwipeArrivedButton extends StatefulWidget {
  const _SwipeArrivedButton({required this.onCompleted});

  final VoidCallback onCompleted;

  @override
  State<_SwipeArrivedButton> createState() => _SwipeArrivedButtonState();
}

class _SwipeArrivedButtonState extends State<_SwipeArrivedButton> {
  static const _thumbSize = 62.0;
  static const _trackHeight = 62.0;

  double _dragOffset = 0;
  bool _completed = false;

  void _onDragUpdate(DragUpdateDetails details, double maxDrag) {
    if (_completed) return;
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    final delta = isRtl ? -details.delta.dx : details.delta.dx;
    setState(() {
      _dragOffset = (_dragOffset + delta).clamp(0, maxDrag);
    });
  }

  void _onDragEnd(double maxDrag) {
    if (_completed) return;
    if (_dragOffset >= maxDrag * 0.82) {
      setState(() {
        _dragOffset = maxDrag;
        _completed = true;
      });
      widget.onCompleted();
      Future<void>.delayed(const Duration(milliseconds: 500), () {
        if (!mounted) return;
        setState(() {
          _dragOffset = 0;
          _completed = false;
        });
      });
      return;
    }
    setState(() => _dragOffset = 0);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxDrag =
            (constraints.maxWidth - _thumbSize).clamp(0.0, double.infinity);
        final progress = maxDrag == 0 ? 0.0 : (_dragOffset / maxDrag).clamp(0.0, 1.0);
        final fillWidth = (_dragOffset + _thumbSize).clamp(_thumbSize, constraints.maxWidth);

        return SizedBox(
          height: _trackHeight,
          child: Stack(
            alignment: AlignmentDirectional.centerStart,
            children: [
              Container(
                height: _trackHeight,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFF7577A2),
                  borderRadius: BorderRadius.circular(15),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                ),
                alignment: Alignment.center,
                child: Text(
                  _completed ? l10n.confirmed : l10n.arrived,
                  style: TextStyle(
                    color: progress > 0.55
                        ? Colors.white
                        : Colors.white.withValues(alpha: 0.92),
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              ClipRRect(
                borderRadius: BorderRadius.circular(15),
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  widthFactor: fillWidth / constraints.maxWidth,
                  child: Container(
                    height: _trackHeight,
                    color: DriverColors.orange,
                  ),
                ),
              ),
              PositionedDirectional(
                start: _dragOffset,
                child: GestureDetector(
                  onHorizontalDragUpdate: (details) => _onDragUpdate(details, maxDrag),
                  onHorizontalDragEnd: (_) => _onDragEnd(maxDrag),
                  child: Container(
                    width: _thumbSize,
                    height: _trackHeight,
                    decoration: BoxDecoration(
                      color: DriverColors.orange,
                      borderRadius: BorderRadius.circular(15),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x44000000),
                          blurRadius: 8,
                          offset: Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Icon(
                      Icons.chevron_right_rounded,
                      color: Colors.white,
                      size: 34,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _RouteStopsPreview extends StatelessWidget {
  const _RouteStopsPreview({
    required this.route,
    required this.stops,
  });

  final RouteModel route;
  final List<StopModel> stops;

  String _label(
    BuildContext context,
    String original, {
    String? nameAr,
    String? nameEn,
  }) {
    return context.displayPlaceName(
      original,
      nameAr: nameAr,
      nameEn: nameEn,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final items = <({String title, String subtitle, Color color})>[];

    final from = route.fromLocation;
    if (from != null) {
      items.add((
        title: l10n.mapStart,
        subtitle: _label(
          context,
          from.address,
          nameAr: from.addressAr,
          nameEn: from.addressEn,
        ),
        color: DriverMapConfig.startGreen,
      ));
    }

    for (var i = 0; i < stops.length; i++) {
      final stop = stops[i];
      items.add((
        title: '${l10n.mapStart == 'Start' ? 'Stop' : 'محطة'} ${i + 1}',
        subtitle: _label(
          context,
          stop.name,
          nameAr: stop.nameAr,
          nameEn: stop.nameEn,
        ),
        color: DriverColors.orange,
      ));
    }

    final to = route.toLocation;
    if (to != null) {
      items.add((
        title: l10n.mapEnd,
        subtitle: _label(
          context,
          to.address,
          nameAr: to.addressAr,
          nameEn: to.addressEn,
        ),
        color: DriverMapConfig.endRed,
      ));
    }

    return Container(
      decoration: BoxDecoration(
        color: DriverColors.navyPanel,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final item = items[index];
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 10,
                height: 10,
                margin: const EdgeInsets.only(top: 5),
                decoration: BoxDecoration(
                  color: item.color,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.subtitle,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.72),
                        fontSize: 12,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
