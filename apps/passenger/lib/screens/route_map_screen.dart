import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:tardadi_core/tardadi_core.dart';

import '../l10n/app_localizations.dart';
import '../models/route_list_item.dart';
import '../services/bus_arrival_notifications.dart';
import '../services/passenger_api.dart';
import '../ui/trddk_typography.dart';
import '../widgets/left_back_button.dart';
import '../widgets/onboarding/onboarding_theme.dart';
import '../widgets/passenger_route_map.dart';
import '../widgets/tardadi_brand_video.dart';
import '../widgets/vehicle_icon.dart';

class RouteMapScreen extends StatefulWidget {
  const RouteMapScreen({super.key, required this.route});

  final RouteListItem route;

  @override
  State<RouteMapScreen> createState() => _RouteMapScreenState();
}

class _RouteMapScreenState extends State<RouteMapScreen> {
  final _notifications = BusArrivalNotificationService.instance;
  RouteLiveSnapshot? _snapshot;
  List<BusArrivalItem> _buses = [];
  var _loading = true;
  String? _loadError;
  Timer? _refreshTimer;
  var _liveLoadInFlight = false;
  GeoPoint? _passengerPosition;

  TardadiApi get _api => createPassengerApi(
        organizationId: widget.route.businessId,
      );

  @override
  void initState() {
    super.initState();
    _notifications.addListener(_onNotificationsChanged);
    unawaited(_loadPassengerPosition());
    _loadLive();
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) => _loadLive());
  }

  var _locationPromptShown = false;

  Future<void> _loadPassengerPosition() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        await _showLocationAlert(serviceOff: true);
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        await _showLocationAlert(
          serviceOff: false,
          permanentlyDenied: permission == LocationPermission.deniedForever,
        );
        return;
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(timeLimit: Duration(seconds: 8)),
      );
      if (!mounted) return;
      setState(() {
        _passengerPosition = GeoPoint(
          latitude: position.latitude,
          longitude: position.longitude,
        );
      });
    } catch (_) {}
  }

  /// Tells the passenger why their location isn't on the map and offers a
  /// shortcut to fix it, instead of leaving the map silently without them.
  Future<void> _showLocationAlert({
    required bool serviceOff,
    bool permanentlyDenied = false,
  }) async {
    if (!mounted || _locationPromptShown) return;
    _locationPromptShown = true;
    final l10n = context.l10n;
    // On Android a plain "denied" can still be asked again in-app; anything
    // else needs the system settings.
    final canAskAgain = !serviceOff && !permanentlyDenied;
    final action = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => Directionality(
        textDirection: l10n.textDirection,
        child: AlertDialog(
          backgroundColor: OnboardingTheme.card,
          title: Text(
            l10n.locationOffTitle,
            style: TrddkTypography.text(
              color: OnboardingTheme.white,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          content: Text(
            serviceOff ? l10n.locationServiceOffMessage : l10n.locationDeniedMessage,
            style: TrddkTypography.text(color: OnboardingTheme.muted, fontSize: 15),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: Text(
                l10n.notNow,
                style: TrddkTypography.text(color: OnboardingTheme.muted, fontSize: 14),
              ),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text(
                canAskAgain ? l10n.locationAllowButton : l10n.openSettings,
                style: TrddkTypography.text(
                  color: OnboardingTheme.orange,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
    if (action != true) return;
    if (serviceOff) {
      await Geolocator.openLocationSettings();
    } else if (permanentlyDenied) {
      await Geolocator.openAppSettings();
    } else {
      final retry = await Geolocator.requestPermission();
      if (retry == LocationPermission.deniedForever) {
        await Geolocator.openAppSettings();
      } else if (retry == LocationPermission.whileInUse ||
          retry == LocationPermission.always) {
        _locationPromptShown = false;
        unawaited(_loadPassengerPosition());
      }
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _notifications.removeListener(_onNotificationsChanged);
    super.dispose();
  }

  void _onNotificationsChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _loadLive() async {
    if (_liveLoadInFlight) return;
    _liveLoadInFlight = true;
    final firstLoad = _snapshot == null;
    if (mounted && firstLoad) {
      setState(() {
        _loading = true;
        _loadError = null;
      });
    }
    try {
      final snapshot = await _api.getRouteLive(
        widget.route.routeId,
        organizationId: widget.route.businessId,
      );
      if (!mounted) return;
      final visibleBuses = snapshot.buses
          .where((bus) => bus.crowdLevel != 'on_break')
          .toList();
      final buses = visibleBuses
          .map(
            (bus) => BusArrivalItem.fromBus(
              bus,
              minutesAway: _estimateMinutes(bus, snapshot.stops, snapshot.route),
            ),
          )
          .toList();

      if (!mounted) return;
      setState(() {
        _snapshot = snapshot;
        _buses = buses;
        _loading = false;
        _loadError = null;
      });
      _notifications.updateFromLive(buses: buses, stops: snapshot.stops);
    } catch (error) {
      if (!mounted) return;
      final fallback = _fallbackSnapshot();
      setState(() {
        _loading = false;
        if (fallback != null) {
          _snapshot = fallback;
          _buses = fallback.buses
              .map(
                (bus) => BusArrivalItem.fromBus(
                  bus,
                  minutesAway: _estimateMinutes(
                    bus,
                    fallback.stops,
                    fallback.route,
                  ),
                ),
              )
              .toList();
          _loadError = null;
        } else {
          _loadError = error.toString().replaceFirst('Exception: ', '');
        }
      });
    } finally {
      _liveLoadInFlight = false;
    }
  }

  RouteLiveSnapshot? _fallbackSnapshot() {
    final cachedRoute = widget.route.route;
    if (cachedRoute == null) return null;
    return RouteLiveSnapshot(
      route: cachedRoute,
      stops: const [],
      buses: const [],
      liveBusCount: widget.route.liveBusCount,
    );
  }

  GeoPoint? _etaTarget(List<StopModel> stops, RouteModel route) {
    if (stops.isNotEmpty) {
      final stop = stops.first;
      return GeoPoint(latitude: stop.latitude, longitude: stop.longitude);
    }
    final from = route.fromLocation;
    if (from != null) return from.toGeoPoint();
    final points = decodeRoutePolyline(route.polyline);
    if (points.isNotEmpty) {
      return GeoPoint(
        latitude: points.first.latitude,
        longitude: points.first.longitude,
      );
    }
    final to = route.toLocation;
    return to?.toGeoPoint();
  }

  int _estimateMinutes(BusModel bus, List<StopModel> stops, RouteModel route) {
    final location = bus.currentLocation;
    final target = _etaTarget(stops, route);
    if (location == null || target == null) return 0;

    return estimateEtaMinutes(location, target);
  }

  Future<void> _toggleBell(BusArrivalItem bus) async {
    await _notifications.toggle(
      busId: bus.id,
      busName: bus.name,
      routeId: widget.route.routeId,
    );
  }

  void _openFullMap() {
    final snapshot = _snapshot;
    if (snapshot == null) return;

    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _FullRouteMapScreen(
          title: context.l10n.routeDisplayName(widget.route),
          route: snapshot.route,
          stops: snapshot.stops,
          buses: snapshot.buses,
          passengerPosition: _passengerPosition,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final snapshot = _snapshot;
    final routeName = l10n.routeDisplayName(widget.route);
    final liveCount = snapshot?.liveBusCount ?? widget.route.liveBusCount;

    return Scaffold(
      backgroundColor: OnboardingTheme.background,
      appBar: LeftBackAppBar(
        backgroundColor: OnboardingTheme.background,
        onBack: () => Navigator.of(context).pop(),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              routeName,
              style: const TextStyle(
                color: OnboardingTheme.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (liveCount > 0)
              Text(
                l10n.liveBusesOnRoute(liveCount),
                style: TextStyle(
                  color: OnboardingTheme.orange.withValues(alpha: 0.95),
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            flex: 6,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: _loading
                  ? const Center(child: TardadiLoading(size: 72))
                  : _loadError != null
                      ? _RouteLoadError(
                          message: _loadError!,
                          onRetry: _loadLive,
                        )
                      : snapshot == null
                          ? const Center(child: TardadiLoading(size: 72))
                          : _RouteMapPreview(
                              onTap: _openFullMap,
                              child: PassengerRouteMap(
                                route: snapshot.route,
                                stops: snapshot.stops,
                                buses: snapshot.buses,
                                passengerPosition: _passengerPosition,
                                borderRadius: 16,
                              ),
                            ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                color: OnboardingTheme.background,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(24),
                  topRight: Radius.circular(24),
                ),
              ),
              child: Stack(
                children: [
                  _buses.isEmpty
                      ? Center(
                          child: Text(
                            l10n.noLiveBuses,
                            textAlign: TextAlign.center,
                            style: TrddkTypography.text(
                              color: OnboardingTheme.muted,
                              fontSize: 15,
                            ),
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 20, 16, 28),
                          itemCount: _buses.length,
                          itemBuilder: (context, index) {
                            final bus = _buses[index];
                            return _BusArrivalCard(
                              item: bus,
                              notificationsEnabled:
                                  _notifications.isEnabled(bus.id),
                              onToggleNotifications: () => _toggleBell(bus),
                            );
                          },
                        ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FullRouteMapScreen extends StatelessWidget {
  const _FullRouteMapScreen({
    required this.title,
    required this.route,
    required this.stops,
    required this.buses,
    this.passengerPosition,
  });

  final String title;
  final RouteModel route;
  final List<StopModel> stops;
  final List<BusModel> buses;
  final GeoPoint? passengerPosition;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OnboardingTheme.background,
      appBar: LeftBackAppBar(
        backgroundColor: OnboardingTheme.background,
        onBack: () => Navigator.of(context).pop(),
        title: Text(
          title,
          style: const TextStyle(
            color: OnboardingTheme.white,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: PassengerRouteMap(
          route: route,
          stops: stops,
          buses: buses,
          passengerPosition: passengerPosition,
          borderRadius: 16,
        ),
      ),
    );
  }
}

class _RouteLoadError extends StatelessWidget {
  const _RouteLoadError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.cloud_off_rounded,
              size: 40,
              color: OnboardingTheme.muted.withValues(alpha: 0.8),
            ),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TrddkTypography.text(
                color: OnboardingTheme.muted,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: onRetry,
              child: Text(isArabic ? 'إعادة المحاولة' : 'Retry'),
            ),
          ],
        ),
      ),
    );
  }
}

class _RouteMapPreview extends StatelessWidget {
  const _RouteMapPreview({required this.onTap, required this.child});

  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
          ),
          child: child,
        ),
      ),
    );
  }
}

class _BusArrivalCard extends StatelessWidget {
  const _BusArrivalCard({
    required this.item,
    required this.notificationsEnabled,
    required this.onToggleNotifications,
  });

  final BusArrivalItem item;
  final bool notificationsEnabled;
  final VoidCallback onToggleNotifications;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      decoration: BoxDecoration(
        color: OnboardingTheme.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: OnboardingTheme.white.withValues(alpha: 0.06),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Vehicle — same artwork the driver app uses.
          Container(
            width: 64,
            height: 56,
            decoration: BoxDecoration(
              color: OnboardingTheme.background,
              borderRadius: BorderRadius.circular(14),
            ),
            alignment: Alignment.center,
            child: VehicleIcon(
              vehicleType: item.vehicleType,
              color: OnboardingTheme.white,
              size: 42,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        l10n.vehicleLabel(item.vehicleType, item.name),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TrddkTypography.text(
                          color: OnboardingTheme.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 17,
                          height: 1.15,
                        ),
                      ),
                    ),
                    if (item.isLive) ...[
                      const SizedBox(width: 8),
                      const _LiveBadge(),
                    ],
                  ],
                ),
                const SizedBox(height: 8),
                _CrowdingIndicator(level: item.crowdingLabel),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _EtaBlock(minutes: item.minutesAway),
          Container(
            width: 1,
            height: 40,
            margin: const EdgeInsets.symmetric(horizontal: 12),
            color: OnboardingTheme.white.withValues(alpha: 0.08),
          ),
          _NotificationBellButton(
            enabled: notificationsEnabled,
            onTap: onToggleNotifications,
          ),
        ],
      ),
    );
  }
}

/// Big, glanceable arrival time — the one number the rider cares about.
class _EtaBlock extends StatelessWidget {
  const _EtaBlock({required this.minutes});

  final int minutes;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final arriving = minutes <= 0;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          arriving ? l10n.etaNow : '$minutes',
          style: TrddkTypography.text(
            color: OnboardingTheme.orange,
            fontSize: arriving ? 18 : 26,
            fontWeight: FontWeight.w800,
            height: 1.0,
          ),
        ),
        if (!arriving) ...[
          const SizedBox(height: 4),
          Text(
            l10n.etaUnit,
            style: TrddkTypography.text(
              color: OnboardingTheme.muted,
              fontSize: 12,
              fontWeight: FontWeight.w500,
              height: 1.0,
            ),
          ),
        ],
      ],
    );
  }
}

/// Three-step bar + label instead of a pill chip.
class _CrowdingIndicator extends StatelessWidget {
  const _CrowdingIndicator({required this.level});

  final String level;

  int get _filled => switch (level.toLowerCase()) {
        'low' => 1,
        'medium' => 2,
        'high' => 3,
        _ => 0,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final filled = _filled;
    final activeColor =
        filled >= 3 ? OnboardingTheme.orange : OnboardingTheme.white;
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        for (var i = 0; i < 3; i++)
          Container(
            width: 5,
            height: 8.0 + i * 3,
            margin: const EdgeInsetsDirectional.only(end: 3),
            decoration: BoxDecoration(
              color: i < filled
                  ? activeColor
                  : OnboardingTheme.white.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        const SizedBox(width: 5),
        Flexible(
          child: Text(
            l10n.crowdingLabel(level),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TrddkTypography.text(
              color: OnboardingTheme.muted,
              fontSize: 13,
              fontWeight: FontWeight.w500,
              height: 1.1,
            ),
          ),
        ),
      ],
    );
  }
}

/// Quiet live indicator: pulsing orange dot + label, no glossy pill.
class _LiveBadge extends StatefulWidget {
  const _LiveBadge();

  @override
  State<_LiveBadge> createState() => _LiveBadgeState();
}

class _LiveBadgeState extends State<_LiveBadge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void initState() {
    super.initState();
    // SingleTickerProviderStateMixin mutes this ticker when TickerMode is off,
    // so tests and goldens do not keep a frame scheduled.
    _pulse.repeat();
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 14,
          height: 14,
          child: AnimatedBuilder(
            animation: _pulse,
            builder: (context, _) {
              final t = _pulse.value;
              return Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 6 + 8 * t,
                    height: 6 + 8 * t,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: OnboardingTheme.orange
                          .withValues(alpha: 0.45 * (1 - t)),
                    ),
                  ),
                  Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: OnboardingTheme.orange,
                    ),
                  ),
                ],
              );
            },
          ),
        ),
        const SizedBox(width: 4),
        Text(
          l10n.liveBadge,
          style: TrddkTypography.text(
            color: OnboardingTheme.orange,
            fontSize: 12,
            fontWeight: FontWeight.w700,
            height: 1.0,
          ),
        ),
      ],
    );
  }
}

@visibleForTesting
Widget previewBusArrivalCard({
  required BusArrivalItem item,
  bool notificationsEnabled = false,
}) {
  return _BusArrivalCard(
    item: item,
    notificationsEnabled: notificationsEnabled,
    onToggleNotifications: () {},
  );
}

class _NotificationBellButton extends StatelessWidget {
  const _NotificationBellButton({
    required this.enabled,
    required this.onTap,
  });

  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: AnimatedContainer(
          duration: OnboardingTheme.motionFast,
          curve: OnboardingTheme.motionCurve,
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: enabled
                ? OnboardingTheme.orange
                : OnboardingTheme.white.withValues(alpha: 0.08),
          ),
          child: Icon(
            enabled
                ? Icons.notifications_active_rounded
                : Icons.notifications_none_rounded,
            color: enabled
                ? OnboardingTheme.white
                : OnboardingTheme.white.withValues(alpha: 0.75),
            size: 21,
          ),
        ),
      ),
    );
  }
}
