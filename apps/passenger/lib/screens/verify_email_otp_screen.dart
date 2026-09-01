import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../l10n/app_localizations.dart';
import '../services/passenger_api.dart';
import '../services/user_session.dart';
import '../widgets/onboarding/numeric_keypad.dart';
import '../widgets/onboarding/onboarding_scale.dart';
import '../widgets/onboarding/onboarding_theme.dart';
import '../widgets/onboarding/verification_header.dart';
import 'company_selection_screen.dart';
import 'routes_main_screen.dart';

class VerifyEmailOtpScreen extends StatefulWidget {
  const VerifyEmailOtpScreen({super.key, required this.email});

  final String email;

  @override
  State<VerifyEmailOtpScreen> createState() => _VerifyEmailOtpScreenState();
}

class _VerifyEmailOtpScreenState extends State<VerifyEmailOtpScreen> {
  final _otpControllers = List.generate(6, (_) => TextEditingController());
  final _focusNodes = List.generate(6, (_) => FocusNode());
  final _api = createPassengerApi();
  var _secondsLeft = 60;
  var _loading = false;
  String? _error;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    for (final node in _focusNodes) {
      node.canRequestFocus = false;
    }
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_secondsLeft == 0) return;
      setState(() => _secondsLeft--);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _otpControllers) {
      c.dispose();
    }
    for (final n in _focusNodes) {
      n.dispose();
    }
    super.dispose();
  }

  String get _otp => _otpControllers.map((c) => c.text).join();

  String get _timerLabel {
    final minutes = (_secondsLeft ~/ 60).toString().padLeft(2, '0');
    final seconds = (_secondsLeft % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  void _onKeyTap(String value) {
    if (value == 'back') {
      for (var i = 5; i >= 0; i--) {
        if (_otpControllers[i].text.isNotEmpty) {
          _otpControllers[i].clear();
          setState(() {});
          return;
        }
      }
      return;
    }

    for (var i = 0; i < 6; i++) {
      if (_otpControllers[i].text.isEmpty) {
        _otpControllers[i].text = value;
        setState(() {});
        if (_otp.length == 6) _verify();
        return;
      }
    }
  }

  Future<void> _verify() async {
    if (_loading || _otp.length != 6) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await _api.passengerVerifyEmailOtpDetailed(
        email: widget.email,
        code: _otp,
        purpose: UserSession.instance.isBusiness ? 'business' : 'personal',
      );
      if (!mounted) return;
      if (UserSession.instance.isBusiness) {
        final token = result.verificationToken;
        final memberships = result.memberships;
        if (token == null || memberships.isEmpty) {
          setState(() {
            _error = UserSession.instance.isArabic
                ? 'تعذّر تسجيل الدخول. تحقق من بريدك أو تواصل مع جهة عملك.'
                : 'Unable to sign in. Check your email or contact your employer.';
          });
          return;
        }
        UserSession.instance.setEmail(widget.email);
        if (memberships.length == 1) {
          final session = await _api.passengerBusinessSession(
            verificationToken: token,
            businessId: memberships.first.businessId,
          );
          await UserSession.instance.setBusinessSession(
            email: session.email,
            businessId: session.businessId,
            businessName: session.businessName,
            sessionToken: session.sessionToken,
          );
          if (!mounted) return;
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute<void>(builder: (_) => const RoutesMainScreen()),
            (_) => false,
          );
          return;
        }
        Navigator.of(context).pushReplacement(
          MaterialPageRoute<void>(
            builder: (_) => CompanySelectionScreen(
              email: widget.email,
              verificationToken: token,
              memberships: memberships,
            ),
          ),
        );
        return;
      }
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute<void>(builder: (_) => const RoutesMainScreen()),
        (_) => false,
      );
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
          for (final c in _otpControllers) {
            c.clear();
          }
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resend() async {
    if (_secondsLeft > 0 || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _api.passengerSendEmailOtp(email: widget.email);
      if (!mounted) return;
      setState(() => _secondsLeft = 60);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scale = OnboardingScale(context);
    final l10n = context.l10n;

    return Scaffold(
      backgroundColor: Colors.white,
      resizeToAvoidBottomInset: false,
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            VerificationHeader(scale: scale, onBack: () => Navigator.pop(context)),
            Expanded(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: scale.horizontalPadding),
                child: Column(
                  children: [
                    SizedBox(height: scale.s(16)),
                    Text(
                      l10n.verifyEmailTitle,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: OnboardingTheme.routeTitle,
                        fontSize: scale.verifyTitleSize,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: scale.s(8)),
                    Text(
                      l10n.verifyEmailSubtitle,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: OnboardingTheme.muted,
                        fontSize: scale.s(14),
                      ),
                    ),
                    SizedBox(height: scale.s(8)),
                    Text(
                      widget.email,
                      textDirection: TextDirection.ltr,
                      style: TextStyle(
                        color: OnboardingTheme.orange,
                        fontSize: scale.s(14),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    SizedBox(height: scale.s(24)),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        for (var i = 0; i < 6; i++) ...[
                          if (i > 0) SizedBox(width: scale.s(8)),
                          Container(
                            width: scale.s(44),
                            height: scale.s(52),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF3F4F8),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: _error != null
                                    ? const Color(0xFFF87171)
                                    : const Color(0xFFE5E7EB),
                              ),
                            ),
                            child: Text(
                              _otpControllers[i].text,
                              style: TextStyle(
                                fontSize: scale.s(22),
                                fontWeight: FontWeight.w700,
                                color: OnboardingTheme.routeTitle,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (_error != null) ...[
                      SizedBox(height: scale.s(12)),
                      Text(
                        _error!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Color(0xFFF87171)),
                      ),
                    ],
                    const Spacer(),
                    NumericKeypad(
                      keyHeight: scale.s(48),
                      keyFontSize: scale.s(22),
                      onKeyTap: _onKeyTap,
                    ),
                    SizedBox(height: scale.s(16)),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          l10n.didntReceiveCode,
                          style: TextStyle(color: OnboardingTheme.muted),
                        ),
                        GestureDetector(
                          onTap: _secondsLeft == 0 ? _resend : null,
                          child: Text(
                            _secondsLeft == 0
                                ? l10n.resendCode
                                : l10n.resendIn(_timerLabel),
                            style: TextStyle(
                              color: _secondsLeft == 0
                                  ? OnboardingTheme.orange
                                  : OnboardingTheme.muted,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: scale.s(16)),
                    if (_loading)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 16),
                        child: CircularProgressIndicator(
                          color: OnboardingTheme.orange,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
