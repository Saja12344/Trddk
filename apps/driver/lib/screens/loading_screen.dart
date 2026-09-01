import 'dart:async';

import 'package:flutter/material.dart';
import 'package:tardadi_core/tardadi_core.dart';

import '../services/driver_prefs.dart';
import '../services/session_store.dart';
import '../ui/driver_design.dart';
import '../widgets/animated_brand_splash.dart';
import 'login_screen.dart';
import 'map_screen.dart';
import 'settings_screen.dart';

/// Animated TRDDK splash on cold start.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  void _openLogin() {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      driverRoute(builder: (_) => const LoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: DriverChrome(
        barColor: const Color(TrddkBrandAssets.splashNavy),
        bodyColor: const Color(TrddkBrandAssets.splashNavy),
        child: AnimatedBrandSplash(onFinished: _openLogin),
      ),
    );
  }
}

/// Brief loader after login, before home or first-time vehicle pick.
class LoadingScreen extends StatefulWidget {
  const LoadingScreen({super.key, required this.session});

  final DriverSession session;

  @override
  State<LoadingScreen> createState() => _LoadingScreenState();
}

class _LoadingScreenState extends State<LoadingScreen> {
  @override
  void initState() {
    super.initState();
    SessionStore.instance.set(widget.session);
    unawaited(_continueAfterLoad());
  }

  Future<void> _continueAfterLoad() async {
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;

    final driverKey = DriverPrefs.driverKey(
      phone: widget.session.driver.phone,
      driverId: widget.session.driver.driverId,
    );
    final prefs = DriverPrefs.instance;
    final savedVehicle = await prefs.getSelectedVehicle(driverKey);
    if (savedVehicle != null) {
      SessionStore.instance.setVehicle(savedVehicle);
    }

    final isFirstLogin = !await prefs.hasCompletedVehicleSetup(driverKey);
    final hasActiveTrip = (widget.session.tripId?.isNotEmpty ?? false);
    if (!mounted) return;

    Navigator.of(context).pushReplacement(
      driverRoute(
        builder: (_) => (isFirstLogin && !hasActiveTrip)
            ? const VehicleOnboardingScreen()
            : const MapScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return const DriverChrome(
      child: Center(
        child: SizedBox(
          width: 72,
          height: 72,
          child: CircularProgressIndicator(
            color: DriverColors.orange,
            strokeWidth: 3,
          ),
        ),
      ),
    );
  }
}
