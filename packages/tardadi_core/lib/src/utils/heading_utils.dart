import 'dart:math' as math;

/// Minimum speed (m/s) before accepting a new GPS heading (~7 km/h).
const kMinHeadingSpeedMps = 2.0;

/// Smooth heading updates and keep the last trustworthy bearing at low speed.
class HeadingTracker {
  HeadingTracker({this.smoothing = 0.22});

  final double smoothing;
  double? _lastHeading;
  double? _displayHeading;

  double? update({
    required double? heading,
    required double speedMps,
  }) {
    final normalized = _normalizeHeading(heading);
    if (normalized != null && speedMps >= kMinHeadingSpeedMps) {
      _lastHeading = normalized;
    }

    final target = _lastHeading;
    if (target == null) return _displayHeading;

    if (_displayHeading == null) {
      _displayHeading = target;
      return _displayHeading;
    }

    _displayHeading = _lerpAngle(_displayHeading!, target, smoothing);
    return _displayHeading;
  }

  void reset() {
    _lastHeading = null;
    _displayHeading = null;
  }

  static double? _normalizeHeading(double? heading) {
    if (heading == null || !heading.isFinite || heading < 0) return null;
    return heading % 360;
  }

  static double _lerpAngle(double from, double to, double t) {
    var delta = (to - from) % 360;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return (from + delta * t) % 360;
  }
}

double headingBetween({
  required double fromLat,
  required double fromLng,
  required double toLat,
  required double toLng,
}) {
  final lat1 = fromLat * math.pi / 180;
  final lat2 = toLat * math.pi / 180;
  final dLng = (toLng - fromLng) * math.pi / 180;
  final y = math.sin(dLng) * math.cos(lat2);
  final x = math.cos(lat1) * math.sin(lat2) -
      math.sin(lat1) * math.cos(lat2) * math.cos(dLng);
  return (math.atan2(y, x) * 180 / math.pi + 360) % 360;
}
