import 'package:flutter/material.dart';
import 'package:tardadi_core/tardadi_core.dart';

export 'package:tardadi_core/tardadi_core.dart'
    show TrddkBrandLockup, TrddkBusMark, TrddkWordmarkImage;

/// Approved bus symbol.
class TardadiLogoIcon extends StatelessWidget {
  const TardadiLogoIcon({super.key, this.size = 28});

  final double size;

  @override
  Widget build(BuildContext context) => TrddkBusMark(size: size);
}

/// Approved English wordmark image.
class TrddkWordmark extends StatelessWidget {
  const TrddkWordmark({super.key, required this.height});

  final double height;

  @override
  Widget build(BuildContext context) => TrddkWordmarkImage(height: height);
}

/// Full lockup for headers.
class TardadiLogo extends StatelessWidget {
  const TardadiLogo({
    super.key,
    this.height = 48,
  });

  final double height;

  @override
  Widget build(BuildContext context) => TrddkBrandLockup(height: height);
}
