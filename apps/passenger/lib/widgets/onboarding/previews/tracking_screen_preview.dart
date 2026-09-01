import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../onboarding_stagger_reveal.dart';
import '../onboarding_theme.dart';
import '../onboarding_typography.dart';

class TrackingScreenPreview extends StatefulWidget {
  const TrackingScreenPreview({
    super.key,
    required this.width,
    required this.height,
    this.isActive = true,
  });

  final double width;
  final double height;
  final bool isActive;

  @override
  State<TrackingScreenPreview> createState() => _TrackingScreenPreviewState();
}

class _TrackingScreenPreviewState extends State<TrackingScreenPreview>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  static const _mapBorderRadius = 20.0;
  static const _overlayInset = 16.0;
  static const _mapAsset = 'assets/images/onboarding_map_dark.jpg';

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: OnboardingPreviewMotion.entrance,
    );
    if (widget.isActive) _controller.forward();
  }

  @override
  void didUpdateWidget(TrackingScreenPreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  double get _s => math.min(widget.width / 320, widget.height / 252);

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = _controller.value;
        final busT =
            OnboardingPreviewMotion.step(2).transform(t).clamp(0.0, 1.0);
        final etaT = OnboardingPreviewMotion.step(3).transform(t);
        final cardT = OnboardingPreviewMotion.step(4).transform(t);

        return ClipRRect(
          borderRadius: BorderRadius.circular(_mapBorderRadius),
          clipBehavior: Clip.antiAlias,
          child: SizedBox(
            width: widget.width,
            height: widget.height,
            child: Stack(
              fit: StackFit.expand,
              clipBehavior: Clip.hardEdge,
              children: [
                Positioned.fill(
                  child: Image.asset(
                    _mapAsset,
                    fit: BoxFit.cover,
                    alignment: Alignment.center,
                    filterQuality: FilterQuality.medium,
                  ),
                ),
                Positioned(
                  top: _overlayInset,
                  right: _overlayInset,
                  child: Opacity(
                    opacity: etaT,
                    child: Transform.translate(
                      offset: Offset(0, (1 - etaT) * 8),
                      child: _EtaChip(
                        scale: _s,
                        minutes: (5 - busT * 3).round().clamp(2, 5),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: _overlayInset,
                  right: _overlayInset,
                  bottom: _overlayInset,
                  child: Opacity(
                    opacity: cardT,
                    child: Transform.translate(
                      offset: Offset(0, (1 - cardT) * 12),
                      child: _FloatingInfoCard(scale: _s, minutes: 2),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _EtaChip extends StatelessWidget {
  const _EtaChip({required this.scale, required this.minutes});

  final double scale;
  final int minutes;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: 10 * scale,
        vertical: 6 * scale,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10 * scale),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Text(
        '$minutes min',
        style: OnboardingTypography.label(
          fontSize: 11 * scale,
          fontWeight: FontWeight.w700,
          color: OnboardingTheme.orange,
        ),
      ),
    );
  }
}

class _FloatingInfoCard extends StatelessWidget {
  const _FloatingInfoCard({required this.scale, required this.minutes});

  final double scale;
  final int minutes;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: 12 * scale,
        vertical: 8 * scale,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12 * scale),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 26 * scale,
            height: 26 * scale,
            decoration: BoxDecoration(
              color: OnboardingTheme.orange.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8 * scale),
            ),
            child: Icon(
              Icons.directions_bus_rounded,
              size: 15 * scale,
              color: OnboardingTheme.orange,
            ),
          ),
          SizedBox(width: 10 * scale),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Bus 12',
                  style: OnboardingTypography.label(
                    fontSize: 12 * scale,
                    color: const Color(0xFF1C1C1E),
                  ),
                ),
                Text(
                  '$minutes min away · Low crowding',
                  style: OnboardingTypography.body(
                    fontSize: 10 * scale,
                    color: const Color(0xFF8E8E93),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
