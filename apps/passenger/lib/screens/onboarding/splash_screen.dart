import 'package:flutter/material.dart';
import 'package:tardadi_core/tardadi_core.dart';

import '../../widgets/animated_brand_splash.dart';
import 'onboarding_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  var _navigated = false;

  void _finishSplash() {
    if (_navigated || !mounted) return;
    _navigated = true;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => const OnboardingScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Scaffold(
        backgroundColor: const Color(TrddkBrandAssets.splashNavy),
        body: AnimatedBrandSplash(onFinished: _finishSplash),
      ),
    );
  }
}
