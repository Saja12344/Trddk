import 'package:flutter/material.dart';
import 'package:tardadi_core/tardadi_core.dart';

import '../../services/user_session.dart';
import '../../widgets/animated_brand_splash.dart';
import '../account_type_screen.dart';
import '../enter_email_screen.dart';
import '../routes_main_screen.dart';
import 'onboarding_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  var _navigated = false;

  Future<void> _finishSplash() async {
    if (_navigated || !mounted) return;
    _navigated = true;

    final session = UserSession.instance;
    final Widget next;

    if (!session.hasCompletedOnboarding) {
      next = const OnboardingScreen();
    } else if (session.accountType == null) {
      next = const AccountTypeScreen();
    } else if (session.accountType == AccountType.personal) {
      next = const RoutesMainScreen();
    } else if (session.hasBusinessSession) {
      next = const RoutesMainScreen();
    } else {
      next = const EnterEmailScreen(accountType: AccountType.business);
    }

    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => next),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Scaffold(
        backgroundColor: const Color(TrddkBrandAssets.splashNavy),
        body: AnimatedBrandSplash(onFinished: _finishSplash),
      ),
    );
  }
}
