import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'trddk_brand_assets.dart';

/// Splash: large bus centered → shrinks into right [logo] slot → [word] slot fills left.
class TrddkBrandSplash extends StatefulWidget {
  const TrddkBrandSplash({
    super.key,
    required this.onFinished,
    this.scaleFactor = 1,
    this.duration = const Duration(milliseconds: 2400),
  });

  final VoidCallback onFinished;
  final double scaleFactor;
  final Duration duration;

  @override
  State<TrddkBrandSplash> createState() => _TrddkBrandSplashState();
}

class _TrddkBrandSplashState extends State<TrddkBrandSplash>
    with SingleTickerProviderStateMixin {
  static const _iconAsset = AssetImage(TrddkBrandAssets.busMark);
  static const _wordmarkAsset = AssetImage(TrddkBrandAssets.wordmark);

  late final AnimationController _controller;
  var _assetsReady = false;

  double s(double value) => value * widget.scaleFactor;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    WidgetsBinding.instance.addPostFrameCallback((_) => _prepare());
  }

  Future<void> _prepare() async {
    if (!mounted) return;
    await Future.wait([
      _resolveImage(_iconAsset),
      _resolveImage(_wordmarkAsset),
    ]);
    if (!mounted) return;
    setState(() => _assetsReady = true);
    await _controller.forward();
    if (!mounted) return;
    await Future<void>.delayed(const Duration(milliseconds: 220));
    if (mounted) widget.onFinished();
  }

  Future<void> _resolveImage(AssetImage provider) async {
    final config = createLocalImageConfiguration(context);
    final stream = provider.resolve(config);
    final completer = Completer<void>();
    late ImageStreamListener listener;
    listener = ImageStreamListener(
      (image, _) {
        stream.removeListener(listener);
        if (!completer.isCompleted) completer.complete();
      },
      onError: (_, _) {
        stream.removeListener(listener);
        if (!completer.isCompleted) completer.complete();
      },
    );
    stream.addListener(listener);
    return completer.future;
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  double _moveProgress(double t) {
    if (t < 0.18) return 0;
    if (t < 0.68) {
      return Curves.easeInOutCubic.transform((t - 0.18) / 0.50);
    }
    return 1;
  }

  double _wordmarkOpacity(double t) {
    if (t < 0.68) return 0;
    if (t < 0.88) {
      return Curves.easeOut.transform((t - 0.68) / 0.20);
    }
    return 1;
  }

  double _wordmarkSlide(double t) {
    if (t < 0.68) return s(10);
    if (t < 0.88) {
      return s(10) * (1 - Curves.easeOut.transform((t - 0.68) / 0.20));
    }
    return 0;
  }

  Widget _buildFrame(double t) {
    final lockupH = s(TrddkBrandAssets.lockupHeight);
    final wordSlotW = s(TrddkBrandAssets.lockupWordSlotWidth);
    final gapW = s(TrddkBrandAssets.lockupGap);
    final logoSlotW = s(TrddkBrandAssets.lockupLogoSlotWidth);
    final lockupW = wordSlotW + gapW + logoSlotW;

    final startIconSize = s(TrddkBrandAssets.lockupStartBusSize);
    final wordH = TrddkBrandAssets.lockupWordHeight(lockupH);
    final endIconH = TrddkBrandAssets.lockupIconHeight(lockupH);
    final endIconW = TrddkBrandAssets.lockupIconWidth(endIconH);

    final logoSlotLeft = wordSlotW + gapW;
    final endIconLeft = logoSlotLeft + (logoSlotW - endIconW) / 2;
    final endIconTop =
        lockupH / 2 - endIconH * TrddkBrandAssets.iconVisualCenterY;
    final wordDy = TrddkBrandAssets.lockupOpticalDy(
      wordH,
      TrddkBrandAssets.wordmarkVisualCenterY,
    );

    final move = _moveProgress(t);
    final wordOpacity = _wordmarkOpacity(t);
    final wordSlide = _wordmarkSlide(t);

    final iconW = startIconSize + (endIconW - startIconSize) * move;
    final iconH = startIconSize + (endIconH - startIconSize) * move;

    final startIconLeft = lockupW / 2 - startIconSize / 2;
    final startIconTop = lockupH / 2 - startIconSize / 2;
    final iconLeft = startIconLeft + (endIconLeft - startIconLeft) * move;
    final iconTop = startIconTop + (endIconTop - startIconTop) * move;

    return Center(
      child: SizedBox(
        width: lockupW,
        height: lockupH,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            if (wordOpacity > 0)
              Positioned(
                left: wordSlide,
                top: 0,
                width: wordSlotW,
                height: lockupH,
                child: Opacity(
                  opacity: wordOpacity,
                  child: Center(
                    child: Transform.translate(
                      offset: Offset(0, wordDy),
                      child: _brandMark(
                        _wordmarkAsset,
                        height: wordH,
                      ),
                    ),
                  ),
                ),
              ),
            Positioned(
              left: iconLeft,
              top: iconTop,
              width: iconW,
              height: iconH,
              child: _brandMark(_iconAsset, height: iconH, width: iconW),
            ),
          ],
        ),
      ),
    );
  }

  Widget _brandMark(
    ImageProvider image, {
    required double height,
    double? width,
  }) {
    return Image(
      image: image,
      height: height,
      width: width,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      gaplessPlayback: true,
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = _assetsReady ? _controller.value : 0.0;
        return _buildFrame(t);
      },
    );
  }
}

/// Scale helper for splash (matches onboarding scale).
double trddkSplashScaleFactor(BuildContext context) {
  final size = MediaQuery.sizeOf(context);
  return math.min(size.width / 390, size.height / 844).clamp(0.72, 1.22);
}
