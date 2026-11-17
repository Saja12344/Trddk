import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

/// Temporary startup instrumentation — remove after diagnosis.
abstract final class StartupTimeline {
  static final Stopwatch _appStopwatch = Stopwatch()..start();
  static int _frameCount = 0;
  static var _firstFrameLogged = false;

  static int get elapsedMs => _appStopwatch.elapsedMilliseconds;

  static void mark(
    String phase, {
    String detail = '',
    String event = 'mark',
    int? durationMs,
    bool mainIsolate = true,
  }) {
    final buffer = StringBuffer()
      ..write('[STARTUP][$phase][${elapsedMs}ms][$event]')
      ..write(' main=$mainIsolate');
    if (durationMs != null) {
      buffer.write(' duration=${durationMs}ms');
    }
    if (detail.isNotEmpty) {
      buffer.write(' $detail');
    }
    debugPrint(buffer.toString());
  }

  static Future<T> track<T>(
    String phase,
    Future<T> Function() action, {
    String detail = '',
  }) async {
    mark(phase, detail: detail, event: 'start');
    final sw = Stopwatch()..start();
    try {
      return await action();
    } finally {
      sw.stop();
      mark(
        phase,
        detail: detail,
        event: 'end',
        durationMs: sw.elapsedMilliseconds,
      );
    }
  }

  static T trackSync<T>(
    String phase,
    T Function() action, {
    String detail = '',
  }) {
    mark(phase, detail: detail, event: 'start');
    final sw = Stopwatch()..start();
    try {
      return action();
    } finally {
      sw.stop();
      mark(
        phase,
        detail: detail,
        event: 'end',
        durationMs: sw.elapsedMilliseconds,
      );
    }
  }

  static void onFirstFrame() {
    if (_firstFrameLogged) return;
    _firstFrameLogged = true;
    mark('first_frame', event: 'end', detail: 'first rasterized frame');
  }

  static void installFrameProbe({String label = 'frame_probe'}) {
    SchedulerBinding.instance.addTimingsCallback((timings) {
      for (final timing in timings) {
        _frameCount++;
        final buildMs = timing.buildDuration.inMilliseconds;
        final rasterMs = timing.rasterDuration.inMilliseconds;
        if (buildMs >= 16 || rasterMs >= 16 || _frameCount <= 5) {
          mark(
            label,
            event: 'frame',
            detail:
                'n=$_frameCount build=${buildMs}ms raster=${rasterMs}ms total=${timing.totalSpan.inMilliseconds}ms',
          );
        }
      }
    });
  }

  static void schedulePostFrame(String phase, {String detail = ''}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      mark(phase, detail: detail, event: 'post_frame');
    });
  }
}
