import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:tardadi_core/tardadi_core.dart';

/// Passenger splash — shared [TrddkBrandSplash] animation.
class AnimatedBrandSplash extends StatelessWidget {
  const AnimatedBrandSplash({super.key, required this.onFinished});

  final VoidCallback onFinished;

  @override
  Widget build(BuildContext context) {
    final duration = defaultTargetPlatform == TargetPlatform.android
        ? const Duration(milliseconds: 900)
        : const Duration(milliseconds: 2400);

    return TrddkBrandSplash(
      onFinished: onFinished,
      scaleFactor: trddkSplashScaleFactor(context),
      duration: duration,
    );
  }
}
