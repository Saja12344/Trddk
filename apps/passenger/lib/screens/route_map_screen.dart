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
import '../widgets/onboarding/frosted_glass.dart';
import '../widgets/onboarding/onboarding_theme.dart';
import '../widgets/passenger_route_map.dart';
import '../widgets/route_card.dart';
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

  Future<void> _loadPassengerPosition() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
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
          title: context.l10n.localizeRouteName(widget.route.name),
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
    final routeName = l10n.localizeRouteName(widget.route.name);
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

    const titleColor = OnboardingTheme.glassText;
    final chipTextColor = OnboardingTheme.white.withValues(alpha: 0.92);
    final chipIconColor = OnboardingTheme.white.withValues(alpha: 0.85);
    const iconBackground = Color.fromRGBO(255, 255, 255, 0.10);
    const iconBorder = Color.fromRGBO(255, 255, 255, 0.14);
    const chipBackground = Color.fromRGBO(255, 255, 255, 0.08);
    const chipBorder = Color.fromRGBO(255, 255, 255, 0.12);

    return FrostedGlass(
      margin: const EdgeInsets.only(bottom: 12),
      borderRadius: 16,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: iconBackground,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: iconBorder),
            ),
            alignment: Alignment.center,
            child: VehicleIcon(
              vehicleType: item.vehicleType,
              color: chipIconColor,
              size: 34,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        l10n.vehicleLabel(item.vehicleType, item.name),
                        style: TrddkTypography.text(
                          color: titleColor,
                          fontWeight: FontWeight.w700,
                          fontSize: 18,
                          height: 1.15,
                        ),
                      ),
                    ),
                    if (item.isLive) const _LiveBadge(),
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _ArrivalDetailChip(
                      icon: Icons.schedule_rounded,
                      label: l10n.minutesLabel(item.minutesAway),
                      textColor: chipTextColor,
                      iconColor: chipIconColor,
                      backgroundColor: chipBackground,
                      borderColor: chipBorder,
                    ),
                    _ArrivalDetailChip(
                      icon: Icons.groups_2_rounded,
                      label: l10n.crowdingLabel(item.crowdingLabel),
                      textColor: chipTextColor,
                      iconColor: chipIconColor,
                      backgroundColor: chipBackground,
                      borderColor: chipBorder,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          _NotificationBellButton(
            enabled: notificationsEnabled,
            onTap: onToggleNotifications,
          ),
        ],
      ),
    );
  }
}

class _LiveBadge extends StatelessWidget {
  const _LiveBadge();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            OnboardingTheme.orange.withValues(alpha: 0.95),
            OnboardingTheme.orange.withValues(alpha: 0.72),
          ],
        ),
        borderRadius: BorderRadius.circular(999),
        boxShadow: [
          BoxShadow(
            color: OnboardingTheme.orange.withValues(alpha: 0.35),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            l10n.liveBadge,
            style: TrddkTypography.text(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}

class _ArrivalDetailChip extends StatelessWidget {
  const _ArrivalDetailChip({
    required this.icon,
    required this.label,
    required this.textColor,
    required this.iconColor,
    required this.backgroundColor,
    required this.borderColor,
  });

  final IconData icon;
  final String label;
  final Color textColor;
  final Color iconColor;
  final Color backgroundColor;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: iconColor),
          const SizedBox(width: 6),
          Text(
            label,
            style: TrddkTypography.text(
              color: textColor,
              fontSize: 13,
              fontWeight: FontWeight.w600,
              height: 1.1,
            ),
          ),
        ],
      ),
    );
  }
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
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: enabled
                ? OnboardingTheme.orange
                : OnboardingTheme.background.withValues(alpha: 0.35),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: enabled
                  ? OnboardingTheme.orange
                  : OnboardingTheme.muted.withValues(alpha: 0.35),
              width: 1.5,
            ),
          ),
          child: Icon(
            enabled ? Icons.notifications : Icons.notifications_outlined,
            color: enabled ? Colors.white : OnboardingTheme.muted,
            size: 22,
          ),
        ),
      ),
    );
  }
}
