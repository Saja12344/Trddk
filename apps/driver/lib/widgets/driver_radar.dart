import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../ui/driver_design.dart';

/// Premium live-scan radar for the pre-trip driver screen.
class DriverRadar extends StatefulWidget {
  const DriverRadar({super.key, this.size = 232});

  final double size;

  @override
  State<DriverRadar> createState() => _DriverRadarState();
}

class _DriverRadarState extends State<DriverRadar> with TickerProviderStateMixin {
  late final AnimationController _scanController;
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _scanController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3600),
    )..repeat();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _scanController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: SizedBox(
        width: widget.size,
        height: widget.size,
        child: AnimatedBuilder(
          animation: Listenable.merge([_scanController, _pulseController]),
          builder: (context, _) {
            return CustomPaint(
              painter: _PremiumRadarPainter(
                rotation: _scanController.value * math.pi * 2,
                pulse: Curves.easeInOut.transform(_pulseController.value),
                scanPhase: _scanController.value,
              ),
            );
          },
        ),
      ),
    );
  }
}

class _RadarParticle {
  const _RadarParticle({
    required this.angle,
    required this.radiusFactor,
    required this.phase,
  });

  final double angle;
  final double radiusFactor;
  final double phase;
}

class _PremiumRadarPainter extends CustomPainter {
  _PremiumRadarPainter({
    required this.rotation,
    required this.pulse,
    required this.scanPhase,
  });

  static const _beamColor = Color(0xFF6AAEFF);
  static const _cyanCore = Color(0xFF7DD3FC);

  static const _particles = [
    _RadarParticle(angle: 0.4, radiusFactor: 0.42, phase: 0.02),
    _RadarParticle(angle: 1.1, radiusFactor: 0.58, phase: 0.18),
    _RadarParticle(angle: 1.9, radiusFactor: 0.36, phase: 0.31),
    _RadarParticle(angle: 2.6, radiusFactor: 0.72, phase: 0.47),
    _RadarParticle(angle: 3.3, radiusFactor: 0.51, phase: 0.59),
    _RadarParticle(angle: 4.0, radiusFactor: 0.64, phase: 0.71),
    _RadarParticle(angle: 4.8, radiusFactor: 0.47, phase: 0.83),
    _RadarParticle(angle: 5.5, radiusFactor: 0.78, phase: 0.92),
    _RadarParticle(angle: 0.9, radiusFactor: 0.28, phase: 0.38),
    _RadarParticle(angle: 2.2, radiusFactor: 0.68, phase: 0.54),
  ];

  final double rotation;
  final double pulse;
  final double scanPhase;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.width * 0.46;

    _drawOuterGlow(canvas, center, radius);
    _drawRings(canvas, center, radius);
    _drawCrosshairs(canvas, center, radius, size);
    _drawScanBeam(canvas, center, radius);
    _drawCenterGlow(canvas, center);
    _drawParticles(canvas, center, radius);
    _drawLocationIndicator(canvas, center, size.width * 0.135, pulse);
  }

  void _drawOuterGlow(Canvas canvas, Offset center, double radius) {
    for (final layer in [
      (scale: 1.06, alpha: 0.035, blur: 14.0),
      (scale: 1.02, alpha: 0.05, blur: 8.0),
    ]) {
      canvas.drawCircle(
        center,
        radius * layer.scale,
        Paint()
          ..color = _beamColor.withValues(alpha: layer.alpha)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, layer.blur),
      );
    }
  }

  void _drawRings(Canvas canvas, Offset center, double radius) {
    const opacities = [0.12, 0.14, 0.18, 0.16, 0.13];
    for (var i = 0; i < opacities.length; i++) {
      final ringRadius = radius * (i + 1) / opacities.length;
      canvas.drawCircle(
        center,
        ringRadius,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = i == opacities.length - 1 ? 0.65 : 0.8
          ..color = Colors.white.withValues(alpha: opacities[i]),
      );
    }
  }

  void _drawCrosshairs(
    Canvas canvas,
    Offset center,
    double radius,
    Size size,
  ) {
    final paint = Paint()
      ..strokeWidth = 0.6
      ..color = Colors.white.withValues(alpha: 0.08);

    canvas.drawLine(
      Offset(center.dx - radius, center.dy),
      Offset(center.dx + radius, center.dy),
      paint,
    );
    canvas.drawLine(
      Offset(center.dx, center.dy - radius),
      Offset(center.dx, center.dy + radius),
      paint,
    );

    final diag = radius * 0.72;
    final diagPaint = Paint()
      ..strokeWidth = 0.45
      ..color = Colors.white.withValues(alpha: 0.05);
    for (final sign in [-1.0, 1.0]) {
      canvas.drawLine(
        center + Offset(-diag * sign, -diag),
        center + Offset(diag * sign, diag),
        diagPaint,
      );
    }
  }

  void _drawScanBeam(Canvas canvas, Offset center, double radius) {
    final rect = Rect.fromCircle(center: center, radius: radius * 0.98);

    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(rotation);
    canvas.translate(-center.dx, -center.dy);

    final trailPaint = Paint()
      ..shader = SweepGradient(
        startAngle: 0,
        endAngle: math.pi * 2,
        colors: [
          Colors.transparent,
          _beamColor.withValues(alpha: 0.0),
          _beamColor.withValues(alpha: 0.12),
          _beamColor.withValues(alpha: 0.22),
          _beamColor.withValues(alpha: 0.08),
          Colors.transparent,
          Colors.transparent,
        ],
        stops: const [0.0, 0.72, 0.82, 0.88, 0.94, 0.98, 1.0],
      ).createShader(rect);
    canvas.drawArc(rect, 0, math.pi * 2, true, trailPaint);

    final beamPaint = Paint()
      ..shader = SweepGradient(
        startAngle: 0,
        endAngle: math.pi * 2,
        colors: [
          Colors.transparent,
          _beamColor.withValues(alpha: 0.04),
          _beamColor.withValues(alpha: 0.42),
          _beamColor.withValues(alpha: 0.78),
          _beamColor.withValues(alpha: 0.18),
          Colors.transparent,
          Colors.transparent,
        ],
        stops: const [0.0, 0.78, 0.86, 0.905, 0.94, 0.975, 1.0],
      ).createShader(rect);
    canvas.drawArc(rect, 0, math.pi * 2, true, beamPaint);

    canvas.restore();
  }

  void _drawCenterGlow(Canvas canvas, Offset center) {
    canvas.drawCircle(
      center,
      10,
      Paint()
        ..color = _cyanCore.withValues(alpha: 0.14)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 7),
    );
    canvas.drawCircle(
      center,
      4.5,
      Paint()
        ..color = _cyanCore.withValues(alpha: 0.35)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2.5),
    );
    canvas.drawCircle(
      center,
      2,
      Paint()..color = _cyanCore.withValues(alpha: 0.95),
    );
  }

  void _drawParticles(Canvas canvas, Offset center, double radius) {
    for (final particle in _particles) {
      final life = (scanPhase + particle.phase) % 1.0;
      final opacity = _particleOpacity(life);
      if (opacity <= 0.04) continue;

      final distance = radius * particle.radiusFactor;
      final point = center +
          Offset(
            math.cos(particle.angle) * distance,
            math.sin(particle.angle) * distance,
          );

      canvas.drawCircle(
        point,
        1.1,
        Paint()
          ..color = _beamColor.withValues(alpha: opacity)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 0.8),
      );
    }
  }

  double _particleOpacity(double life) {
    if (life < 0.55) {
      return (life / 0.55) * 0.55;
    }
    return (1 - (life - 0.55) / 0.45) * 0.55;
  }

  void _drawLocationIndicator(
    Canvas canvas,
    Offset center,
    double baseSize,
    double pulse,
  ) {
    final scale = 0.93 + pulse * 0.14;
    final size = baseSize * scale;

    canvas.drawCircle(
      center + const Offset(0, 1.5),
      size * 0.46,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.22)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, size * 0.18),
    );

    canvas.drawCircle(
      center,
      size * 0.52,
      Paint()
        ..color = DriverColors.orange.withValues(alpha: 0.22 + pulse * 0.12)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, size * 0.28),
    );

    canvas.drawCircle(
      center,
      size * 0.38,
      Paint()..color = DriverColors.orange,
    );

    canvas.drawCircle(
      center,
      size * 0.38,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = Colors.white.withValues(alpha: 0.28),
    );

    canvas.drawCircle(
      center,
      size * 0.14,
      Paint()..color = Colors.white.withValues(alpha: 0.94),
    );
  }

  @override
  bool shouldRepaint(covariant _PremiumRadarPainter oldDelegate) {
    return oldDelegate.rotation != rotation ||
        oldDelegate.pulse != pulse ||
        oldDelegate.scanPhase != scanPhase;
  }
}
