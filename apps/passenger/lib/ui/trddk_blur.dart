import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Frosted blur — skipped on Android where [BackdropFilter] is very costly.
class TrddkBlur extends StatelessWidget {
  const TrddkBlur({
    super.key,
    required this.child,
    this.sigma = 8,
    this.borderRadius,
  });

  final Widget child;
  final double sigma;
  final BorderRadius? borderRadius;

  static bool get enabled =>
      !kIsWeb && defaultTargetPlatform != TargetPlatform.android;

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.zero;
    final clipped = ClipRRect(borderRadius: radius, child: child);

    if (!enabled) return clipped;

    return ClipRRect(
      borderRadius: radius,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
        child: child,
      ),
    );
  }
}
