import 'package:flutter/material.dart';

/// TRDDK brand typography — bundled Ubuntu (no runtime network fetch).
abstract final class TrddkTypography {
  static const fontFamily = 'Ubuntu';

  static TextStyle text({
    required double fontSize,
    FontWeight fontWeight = FontWeight.w400,
    Color? color,
    double? height,
    double letterSpacing = 0,
  }) {
    return TextStyle(
      fontFamily: fontFamily,
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );
  }

  static TextTheme ubuntuTextTheme(TextTheme base) =>
      base.apply(fontFamily: fontFamily);
}
