import 'package:flutter/material.dart';
import 'package:tardadi_core/tardadi_core.dart';

/// Passenger splash — shared [TrddkBrandSplash] animation.
class AnimatedBrandSplash extends StatelessWidget {
  const AnimatedBrandSplash({super.key, required this.onFinished});

  final VoidCallback onFinished;

  @override
  Widget build(BuildContext context) {
    return TrddkBrandSplash(
      onFinished: onFinished,
      scaleFactor: trddkSplashScaleFactor(context),
    );
  }
}
