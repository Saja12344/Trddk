import 'package:flutter/material.dart';

import '../../ui/trddk_typography.dart';
import 'onboarding_theme.dart';

abstract final class OnboardingTypography {
  static TextStyle display({
    required double fontSize,
    FontWeight fontWeight = FontWeight.w600,
    Color color = OnboardingTheme.white,
    double height = 1.2,
    double letterSpacing = -0.3,
  }) {
    return TrddkTypography.text(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );
  }

  static TextStyle body({
    required double fontSize,
    FontWeight fontWeight = FontWeight.w400,
    Color color = OnboardingTheme.muted,
    double height = 1.45,
    double letterSpacing = 0,
  }) {
    return TrddkTypography.text(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );
  }

  static TextStyle label({
    required double fontSize,
    FontWeight fontWeight = FontWeight.w600,
    Color color = OnboardingTheme.white,
  }) {
    return TrddkTypography.text(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
    );
  }
}
