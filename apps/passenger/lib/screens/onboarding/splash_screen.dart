import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:tardadi_core/tardadi_core.dart';

import '../../debug/startup_timeline.dart';
import '../../services/user_session.dart';
import '../../widgets/animated_brand_splash.dart';
import '../account_type_screen.dart';
import '../routes_main_screen.dart';
import 'onboarding_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  var _navigated = false;
  var _buildCount = 0;

  @override
  void initState() {
    super.initState();
    StartupTimeline.mark('splash_init_state', event: 'start');
    if (defaultTargetPlatform == TargetPlatform.android) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        StartupTimeline.mark(
          'splash_post_frame',
          event: 'end',
          detail: 'android fast-path timer scheduled',
        );
        final delay = UserSession.instance.hasCompletedOnboarding
            ? Duration.zero
            : const Duration(milliseconds: 450);
        StartupTimeline.mark(
          'splash_timer',
          event: 'start',
          detail: 'delay=${delay.inMilliseconds}ms',
        );
        Future<void>.delayed(delay, () {
          StartupTimeline.mark(
            'splash_timer',
            event: 'end',
            detail: 'delay=${delay.inMilliseconds}ms',
            durationMs: delay.inMilliseconds,
          );
          _finishSplash();
        });
      });
    }
    if (defaultTargetPlatform != TargetPlatform.android) {
      // Safety net: never stay stuck on the splash if the animation
      // does not report that it finished (e.g. on the iOS simulator).
      Future<void>.delayed(const Duration(milliseconds: 3500), _finishSplash);
    }
    StartupTimeline.mark('splash_init_state', event: 'end');
  }

  Future<void> _finishSplash() async {
    if (_navigated || !mounted) return;
    _navigated = true;

    StartupTimeline.mark('splash_finish', event: 'start');
    final session = UserSession.instance;
    final Widget next;

    if (!session.hasCompletedOnboarding) {
      next = const OnboardingScreen();
      StartupTimeline.mark(
        'splash_route',
        detail: 'target=OnboardingScreen',
      );
    } else if (session.storeReview ||
        session.hasBusinessSession ||
        session.accountType != null) {
      // A saved "business" choice without a login (from older versions)
      // falls back to public mode instead of asking again on every launch.
      if (!session.storeReview &&
          !session.hasBusinessSession &&
          session.accountType != AccountType.personal) {
        await session.setAccountType(AccountType.personal);
      }
      next = const RoutesMainScreen();
      StartupTimeline.mark(
        'splash_route',
        detail: session.storeReview
            ? 'target=RoutesMainScreen phone'
            : 'target=RoutesMainScreen ${session.accountType?.name}',
      );
    } else {
      // First launch after onboarding: choose the account type once.
      next = const AccountTypeScreen();
      StartupTimeline.mark(
        'splash_route',
        detail: 'target=AccountTypeScreen',
      );
    }

    if (!mounted) return;
    StartupTimeline.mark('push_replacement', event: 'start');
    await Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => next),
    );
    StartupTimeline.mark('push_replacement', event: 'end');
    StartupTimeline.mark('splash_finish', event: 'end');
  }

  @override
  Widget build(BuildContext context) {
    _buildCount++;
    if (_buildCount == 1) {
      StartupTimeline.mark('splash_first_build', event: 'start');
      StartupTimeline.schedulePostFrame(
        'splash_first_build',
        detail: 'splash frame complete',
      );
    }

    final androidFastSplash = defaultTargetPlatform == TargetPlatform.android;

    return Directionality(
      textDirection: TextDirection.ltr,
      child: Scaffold(
        backgroundColor: const Color(TrddkBrandAssets.splashNavy),
        body: androidFastSplash
            ? Center(
                child: Image.asset(
                  TrddkBrandAssets.busMark,
                  height: 88,
                  filterQuality: FilterQuality.medium,
                ),
              )
            : AnimatedBrandSplash(onFinished: _finishSplash),
      ),
    );
  }
}
