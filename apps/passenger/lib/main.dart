import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:tardadi_core/tardadi_core.dart';

import 'debug/startup_timeline.dart';
import 'firebase_options.dart';
import 'l10n/app_localizations.dart';
import 'screens/onboarding/splash_screen.dart';
import 'services/bus_arrival_notifications.dart';
import 'services/local_notification_service.dart';
import 'services/user_session.dart';
import 'ui/trddk_typography.dart';

final rootScaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

Future<void> main() async {
  StartupTimeline.mark('main', event: 'start');
  WidgetsFlutterBinding.ensureInitialized();
  StartupTimeline.mark('ensure_initialized', event: 'end');
  StartupTimeline.installFrameProbe();

  // Required for phone (SMS) sign-in in business mode.
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (error) {
    debugPrint('Firebase init failed: $error');
  }

  await StartupTimeline.track(
    'load_persisted_state',
    UserSession.instance.loadPersistedState,
  );

  StartupTimeline.trackSync(
    'attach_messenger',
    () => BusArrivalNotificationService.instance
        .attachMessenger(rootScaffoldMessengerKey),
  );

  StartupTimeline.mark('run_app', event: 'start');
  runApp(const TardadiPassengerApp());
  StartupTimeline.mark('run_app', event: 'end');

  unawaited(
    StartupTimeline.track(
      'local_notifications_init',
      LocalNotificationService.instance.initialize,
    ),
  );

  WidgetsBinding.instance.addPostFrameCallback((_) {
    StartupTimeline.onFirstFrame();
  });
}

class TardadiPassengerApp extends StatefulWidget {
  const TardadiPassengerApp({super.key});

  @override
  State<TardadiPassengerApp> createState() => _TardadiPassengerAppState();
}

class _TardadiPassengerAppState extends State<TardadiPassengerApp> {
  var _buildCount = 0;

  late final ThemeData _theme = StartupTimeline.trackSync(
    'theme_init',
    () => TardadiBrand.darkTheme().copyWith(
      textTheme: TrddkTypography.ubuntuTextTheme(
        TardadiBrand.darkTheme().textTheme,
      ),
    ),
  );

  @override
  void initState() {
    super.initState();
    StartupTimeline.mark('app_init_state', event: 'start');
    UserSession.instance.addListener(_onSessionChanged);
    StartupTimeline.mark('app_init_state', event: 'end');
  }

  @override
  void dispose() {
    UserSession.instance.removeListener(_onSessionChanged);
    super.dispose();
  }

  void _onSessionChanged() => setState(() {});

  @override
  Widget build(BuildContext context) {
    _buildCount++;
    if (_buildCount == 1) {
      StartupTimeline.mark('app_first_build', event: 'start');
    }

    final session = UserSession.instance;
    final localizations = AppLocalizations(session.language);

    final app = MaterialApp(
      title: 'TRDDK',
      debugShowCheckedModeBanner: false,
      theme: _theme,
      scaffoldMessengerKey: rootScaffoldMessengerKey,
      locale: localizations.locale,
      supportedLocales: const [
        Locale('en'),
        Locale('ar'),
      ],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) {
        return AppLocaleScope(
          localizations: localizations,
          child: Directionality(
            textDirection: localizations.textDirection,
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
      home: const SplashScreen(),
    );

    if (_buildCount == 1) {
      StartupTimeline.schedulePostFrame(
        'app_first_build',
        detail: 'MaterialApp mounted',
      );
    }

    return app;
  }
}
