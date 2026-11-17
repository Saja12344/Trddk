import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// TRDDK brand typography — Ubuntu across driver surfaces.
abstract final class TrddkTypography {
  static TextStyle text({
    required double fontSize,
    FontWeight fontWeight = FontWeight.w400,
    Color? color,
    double? height,
    double letterSpacing = 0,
  }) {
    return GoogleFonts.ubuntu(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );
  }

  static TextTheme ubuntuTextTheme(TextTheme base) =>
      GoogleFonts.ubuntuTextTheme(base);
}
