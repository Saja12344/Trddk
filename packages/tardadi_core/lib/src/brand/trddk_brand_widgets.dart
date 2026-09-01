import 'package:flutter/material.dart';

import 'trddk_brand_assets.dart';

/// Approved bus symbol only.
class TrddkBusMark extends StatelessWidget {
  const TrddkBusMark({super.key, required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return _brandAsset(
      TrddkBrandAssets.busMark,
      height: size,
      width: size,
    );
  }
}

/// Approved English wordmark image — never render "Trddk" as styled text.
class TrddkWordmarkImage extends StatelessWidget {
  const TrddkWordmarkImage({super.key, required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return _brandAsset(TrddkBrandAssets.wordmark, height: height);
  }
}

Widget _brandAsset(
  String asset, {
  required double height,
  double? width,
}) {
  return Image.asset(
    asset,
    height: height,
    width: width,
    fit: BoxFit.contain,
    filterQuality: FilterQuality.high,
    gaplessPlayback: true,
  );
}

/// Static lockup: word centered in left slot · gap · logo centered in right slot.
class TrddkBrandLockup extends StatelessWidget {
  const TrddkBrandLockup({super.key, required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    final scale = height / TrddkBrandAssets.lockupHeight;
    final wordSlotW = TrddkBrandAssets.lockupWordSlotWidth * scale;
    final gapW = TrddkBrandAssets.lockupGap * scale;
    final logoSlotW = TrddkBrandAssets.lockupLogoSlotWidth * scale;
    final wordH = TrddkBrandAssets.lockupWordHeight(height);
    final iconH = TrddkBrandAssets.lockupIconHeight(height);
    final iconW = TrddkBrandAssets.lockupIconWidth(iconH);
    final width = wordSlotW + gapW + logoSlotW;
    final wordDy = TrddkBrandAssets.lockupOpticalDy(
      wordH,
      TrddkBrandAssets.wordmarkVisualCenterY,
    );
    final iconDy = TrddkBrandAssets.lockupOpticalDy(
      iconH,
      TrddkBrandAssets.iconVisualCenterY,
    );

    return SizedBox(
      width: width,
      height: height,
      child: Row(
        children: [
          SizedBox(
            width: wordSlotW,
            height: height,
            child: Center(
              child: Transform.translate(
                offset: Offset(0, wordDy),
                child: TrddkWordmarkImage(height: wordH),
              ),
            ),
          ),
          SizedBox(width: gapW),
          SizedBox(
            width: logoSlotW,
            height: height,
            child: Center(
              child: Transform.translate(
                offset: Offset(0, iconDy),
                child: _brandAsset(
                  TrddkBrandAssets.busMark,
                  height: iconH,
                  width: iconW,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
