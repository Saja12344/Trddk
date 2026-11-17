import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:latlong2/latlong.dart';
import 'package:tardadi_core/tardadi_core.dart';

class NavManeuverCue {
  const NavManeuverCue({
    required this.stepIndex,
    required this.maneuver,
    required this.instruction,
    required this.distanceMeters,
    this.thenInstruction,
  });

  final int stepIndex;
  final String maneuver;
  final String instruction;
  final double distanceMeters;
  final String? thenInstruction;
}

class _PolylineProjection {
  const _PolylineProjection(this.segmentIndex, this.t);

  final int segmentIndex;
  final double t;
}

const _passedManeuverMeters = 20.0;
const _voiceFarMeters = 300.0;
const _voiceNearMeters = 50.0;
const _offRouteMeters = 50.0;
const _offRouteDelay = Duration(seconds: 10);
const _rerouteCooldown = Duration(seconds: 20);

final _distance = Distance();

double _meters(LatLng a, LatLng b) =>
    _distance.as(LengthUnit.Meter, a, b);

double _segmentT(LatLng a, LatLng b, LatLng point) {
  final latScale = math.cos(a.latitude * math.pi / 180);
  final abx = (b.longitude - a.longitude) * latScale;
  final aby = b.latitude - a.latitude;
  final apx = (point.longitude - a.longitude) * latScale;
  final apy = point.latitude - a.latitude;
  final denom = abx * abx + aby * aby;
  if (denom == 0) return 0;
  return ((apx * abx + apy * aby) / denom).clamp(0.0, 1.0);
}

_PolylineProjection _project(List<LatLng> line, LatLng point) {
  if (line.length < 2) return const _PolylineProjection(0, 0);
  var bestIndex = 0;
  var bestT = 0.0;
  var best = double.infinity;
  for (var i = 0; i < line.length - 1; i++) {
    final t = _segmentT(line[i], line[i + 1], point);
    final projected = LatLng(
      line[i].latitude + (line[i + 1].latitude - line[i].latitude) * t,
      line[i].longitude + (line[i + 1].longitude - line[i].longitude) * t,
    );
    final meters = _meters(point, projected);
    if (meters < best) {
      best = meters;
      bestIndex = i;
      bestT = t;
    }
  }
  return _PolylineProjection(bestIndex, bestT);
}

double _alongMeters(
  List<LatLng> line,
  _PolylineProjection from,
  _PolylineProjection to,
) {
  final behind = to.segmentIndex < from.segmentIndex ||
      (to.segmentIndex == from.segmentIndex && to.t + 1e-6 < from.t);
  if (behind) return 0;
  if (from.segmentIndex == to.segmentIndex) {
    return _meters(line[from.segmentIndex], line[from.segmentIndex + 1]) *
        (to.t - from.t);
  }
  var total = _meters(line[from.segmentIndex], line[from.segmentIndex + 1]) *
      (1 - from.t);
  for (var i = from.segmentIndex + 1; i < to.segmentIndex; i++) {
    total += _meters(line[i], line[i + 1]);
  }
  total += _meters(line[to.segmentIndex], line[to.segmentIndex + 1]) * to.t;
  return total;
}

List<LatLng> navigationLine(DriverNavigationRoute route) => [
      for (final point in route.points)
        LatLng(point.latitude, point.longitude),
    ];

double distanceToPolylineMeters(List<LatLng> line, LatLng point) {
  if (line.isEmpty) return double.infinity;
  if (line.length == 1) return _meters(line.first, point);
  var best = double.infinity;
  for (var i = 0; i < line.length - 1; i++) {
    final t = _segmentT(line[i], line[i + 1], point);
    final projected = LatLng(
      line[i].latitude + (line[i + 1].latitude - line[i].latitude) * t,
      line[i].longitude + (line[i + 1].longitude - line[i].longitude) * t,
    );
    final meters = _meters(point, projected);
    if (meters < best) best = meters;
  }
  return best;
}

NavManeuverCue? nextManeuver(DriverNavigationRoute route, LatLng position) {
  if (route.steps.isEmpty) return null;
  final line = navigationLine(route);
  if (line.length < 2) return null;
  final driver = _project(line, position);

  var nextIndex = route.steps.length - 1;
  var distance = 0.0;
  for (var i = 0; i < route.steps.length; i++) {
    final start = route.steps[i].start;
    final stepPoint = LatLng(start.latitude, start.longitude);
    final along = _alongMeters(line, driver, _project(line, stepPoint));
    if (along > _passedManeuverMeters) {
      nextIndex = i;
      distance = along;
      break;
    }
  }

  final step = route.steps[nextIndex];
  String? thenInstruction;
  if (nextIndex + 1 < route.steps.length) {
    final following = route.steps[nextIndex + 1].instruction.trim();
    if (following.isNotEmpty) thenInstruction = following;
  }
  return NavManeuverCue(
    stepIndex: nextIndex,
    maneuver: step.maneuver,
    instruction: step.instruction.trim(),
    distanceMeters: distance,
    thenInstruction: thenInstruction,
  );
}

/// Allows at most one off-route re-request per 20 seconds, after 10 seconds
/// continuously more than 50 m from the navigation line.
class NavRerouteGate {
  DateTime? _offSince;
  DateTime? _lastReroute;

  bool shouldReroute({
    required double distanceMeters,
    required DateTime now,
  }) {
    if (distanceMeters <= _offRouteMeters) {
      _offSince = null;
      return false;
    }
    _offSince ??= now;
    if (now.difference(_offSince!) < _offRouteDelay) return false;
    if (_lastReroute != null &&
        now.difference(_lastReroute!) < _rerouteCooldown) {
      return false;
    }
    _lastReroute = now;
    _offSince = null;
    return true;
  }

  void noteRouteUpdated() {
    _offSince = null;
  }

  void reset() {
    _offSince = null;
    _lastReroute = null;
  }
}

bool get _isIos => !kIsWeb && Platform.isIOS;

bool _ttsOk(dynamic value) =>
    value == true || value == 1 || value == '1';

/// Speaks maneuver prompts. A missing voice never throws and never blocks
/// the route.
class NavVoiceGuide {
  NavVoiceGuide();

  final FlutterTts _tts = FlutterTts();
  final Set<String> _farSpoken = {};
  final Set<String> _nearSpoken = {};
  var _preparedLanguage = '';
  var _ready = false;
  var _unavailable = false;
  var _speaking = false;

  bool get unavailable => _unavailable;

  VoidCallback? onUnavailable;

  Future<void> prepare(String languageCode) async {
    if (_preparedLanguage == languageCode && _ready) return;
    _ready = false;
    _preparedLanguage = languageCode;
    _unavailable = false;
    try {
      await _tts.awaitSpeakCompletion(true);
      await _tts.setVolume(1);
      await _tts.setSpeechRate(0.48);
      if (_isIos) {
        await _tts.autoStopSharedSession(true);
      }
      final found = await _selectVoice(languageCode);
      if (!found) {
        _markUnavailable();
      }
    } catch (_) {
      _markUnavailable();
    } finally {
      _ready = true;
    }
  }

  Future<void> announce({
    required String stepKey,
    required double distanceMeters,
    required String text,
    required bool muted,
  }) async {
    if (!_ready || muted || _unavailable || text.trim().isEmpty) return;
    final near = distanceMeters <= _voiceNearMeters;
    final far = distanceMeters <= _voiceFarMeters;
    if (!near && !far) return;
    if (near) {
      if (_nearSpoken.contains(stepKey)) return;
      _nearSpoken.add(stepKey);
      _farSpoken.add(stepKey);
    } else if (_farSpoken.contains(stepKey)) {
      return;
    } else {
      _farSpoken.add(stepKey);
    }

    if (_speaking && !near) return;
    _speaking = true;
    try {
      if (near) {
        await _tts.stop();
      }
      if (_isIos) await _armIosSession();
      await _tts.speak(text);
    } catch (_) {
      _markUnavailable();
    } finally {
      _speaking = false;
      await _restoreIosSession();
    }
  }

  void resetAnnouncements() {
    _farSpoken.clear();
    _nearSpoken.clear();
  }

  Future<void> stop() async {
    try {
      await _tts.stop();
    } catch (_) {}
    await _restoreIosSession();
  }

  Future<void> dispose() => stop();

  void _markUnavailable() {
    if (_unavailable) return;
    _unavailable = true;
    onUnavailable?.call();
  }

  Future<void> _armIosSession() async {
    if (!_isIos) return;
    await _tts.setIosAudioCategory(
      IosTextToSpeechAudioCategory.playback,
      const [IosTextToSpeechAudioCategoryOptions.duckOthers],
      IosTextToSpeechAudioMode.voicePrompt,
    );
    await _tts.setSharedInstance(true);
  }

  Future<void> _restoreIosSession() async {
    if (!_isIos) return;
    try {
      await _tts.setSharedInstance(false);
    } catch (_) {}
  }

  Future<bool> _selectVoice(String languageCode) async {
    final locales = languageCode == 'ar'
        ? const ['ar-SA', 'ar-AE', 'ar-EG', 'ar']
        : const ['en-US', 'en-GB', 'en'];
    for (final locale in locales) {
      try {
        final available = await _tts.isLanguageAvailable(locale);
        if (!_ttsOk(available)) continue;
        final selected = await _tts.setLanguage(locale);
        if (_ttsOk(selected)) return true;
      } catch (_) {}
    }

    try {
      final voices = await _tts.getVoices;
      if (voices is! List) return false;
      final prefix = languageCode == 'ar' ? 'ar' : 'en';
      for (final voice in voices) {
        if (voice is! Map) continue;
        final locale = '${voice['locale'] ?? ''}'.toLowerCase();
        if (!locale.startsWith(prefix)) continue;
        final name = voice['name'];
        final localeValue = voice['locale'];
        if (name is! String || localeValue is! String) continue;
        final selected = await _tts.setVoice({
          'name': name,
          'locale': localeValue,
        });
        if (_ttsOk(selected)) return true;
      }
    } catch (_) {}
    return false;
  }
}
