/// Approved TRDDK brand asset paths — same filenames in each app `assets/images/`.
abstract final class TrddkBrandAssets {
  static const busMark = 'assets/images/logo_icon.png';
  static const wordmark = 'assets/images/trddk_wordmark.png';

  /// Two-slot lockup: [ word ] · gap · [ logo ].
  static const lockupHeight = 46.0;
  static const lockupWordSlotWidth = 134.0;
  static const lockupGap = 12.0;
  static const lockupLogoSlotWidth = 54.0;
  static const lockupWordHeightScale = 0.82;
  static const lockupIconHeightScale = 0.98;
  static const lockupStartBusSize = 124.0;
  static const brandOrange = 0xFFEB4F26;

  static const wordmarkAspectRatio = 312 / 90;
  static const iconAspectRatio = 441 / 367;

  /// Visual center Y / asset height — aligns word + icon optically, not by bbox.
  static const wordmarkVisualCenterY = 48.8 / 90;
  static const iconVisualCenterY = 170.7 / 367;

  static double lockupWordHeight(double lockupHeight) =>
      lockupHeight * lockupWordHeightScale;

  static double lockupIconHeight(double lockupHeight) =>
      lockupHeight * lockupIconHeightScale;

  static double lockupIconWidth(double iconHeight) =>
      iconHeight * iconAspectRatio;

  static double lockupOpticalDy(double contentHeight, double visualCenterY) =>
      contentHeight * (0.5 - visualCenterY);

  static double lockupTotalWidth(double scale) =>
      (lockupWordSlotWidth + lockupGap + lockupLogoSlotWidth) * scale;

  static const splashNavy = 0xFF11183F;
}
