import 'dart:io' show Platform;

import 'package:flutter/material.dart';

/// Shared visual tokens — driver settings are the reference implementation.
abstract final class TrddkTokens {
  static const Color navy = Color(0xFF12144A);
  static const Color navyDeep = Color(0xFF11183F);
  static const Color purple = Color(0xFF24277A);
  static const Color orange = Color(0xFFEA4F26);
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xB3FFFFFF);
  static const Color textMuted = Color(0x8CFFFFFF);
  static const Color cardFill = Color(0x0FFFFFFF);
  static const Color cardBorder = Color(0x1AFFFFFF);
  static const Color divider = Color(0x1AFFFFFF);
  static const Color segmentTrack = Color(0x14FFFFFF);

  static const double radiusCard = 20;
  static const double radiusButton = 18;
  static const double radiusSegment = 14;

  static bool get _isIos => Platform.isIOS;

  static List<String> get _displayFallback => _isIos
      ? const ['SF Pro Display', 'Helvetica Neue', 'Arial']
      : const ['Roboto', 'sans-serif'];

  static List<String> get _textFallback => _isIos
      ? const ['SF Pro Text', 'Helvetica Neue', 'Arial']
      : const ['Roboto', 'sans-serif'];

  static String? get _displayFamily =>
      _isIos ? '.SF Pro Display' : 'Roboto';

  static String? get _textFamily => _isIos ? '.SF Pro Text' : 'Roboto';

  static TextStyle screenTitle({double size = 18}) => TextStyle(
        fontFamily: _displayFamily,
        fontFamilyFallback: _displayFallback,
        fontSize: size,
        fontWeight: FontWeight.w700,
        color: textPrimary,
        height: 1.2,
      );

  static TextStyle optionLabel({double size = 15}) => TextStyle(
        fontFamily: _textFamily,
        fontFamilyFallback: _textFallback,
        fontSize: size,
        fontWeight: FontWeight.w600,
        color: textPrimary,
      );

  static TextStyle valueText({double size = 13}) => TextStyle(
        fontFamily: _textFamily,
        fontFamilyFallback: _textFallback,
        fontSize: size,
        fontWeight: FontWeight.w400,
        color: textSecondary,
      );

  static TextStyle sectionLabel({required bool isEnglish}) => TextStyle(
        fontFamily: _textFamily,
        fontFamilyFallback: _textFallback,
        fontSize: 11,
        fontWeight: FontWeight.w500,
        letterSpacing: isEnglish ? 0.8 : 0.2,
        color: textMuted,
      );
}
