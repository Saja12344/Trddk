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
  static const _otpTtlSeconds = 10 * 60;
  static const _resendAfterSeconds = 60;

  var _resendSecondsLeft = _otpTtlSeconds;

  bool get _canResend =>
      (_otpTtlSeconds - _resendSecondsLeft) >= _resendAfterSeconds;
  var _loading = false;
  var _verifying = false;
  String? _error;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    for (final node in _focusNodes) {
      node.canRequestFocus = false;
    }
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_resendSecondsLeft == 0) return;
      setState(() => _resendSecondsLeft--);
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

  String _formatCountdown(int totalSeconds) {
    final minutes = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final seconds = (totalSeconds % 60).toString().padLeft(2, '0');
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
        if (_otpCode.length == 6) {
          Future.microtask(_verify);
        }
        return;
      }
    }
  }

  String get _otpCode =>
      _otpControllers.map((c) => c.text).join().replaceAll(RegExp(r'\D'), '');

  Future<void> _verify() async {
    if (_loading || _verifying) return;
    final code = _otpCode;
    if (code.length != 6) return;
    setState(() {
      _loading = true;
      _verifying = true;
      _error = null;
    });
    try {
      final result = await _api.passengerVerifyEmailOtpDetailed(
        email: widget.email.trim(),
        code: code,
        purpose: UserSession.instance.isBusiness ? 'business' : 'personal',
      );
      if (!mounted) return;
      final l10n = context.l10n;
      if (UserSession.instance.isBusiness) {
        final token = result.verificationToken;
        final memberships = result.memberships;
        if (token == null || memberships.isEmpty) {
          setState(() {
            _error = l10n.chooseBusinessModeError;
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
        final l10n = context.l10n;
        setState(() {
          _error = _mapVerifyError(
            e.toString().replaceFirst('Exception: ', ''),
            l10n,
          );
          for (final c in _otpControllers) {
            c.clear();
          }
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _verifying = false;
        });
      }
    }
  }

  Future<void> _resend() async {
    if (!_canResend || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _api.passengerSendEmailOtp(email: widget.email.trim());
      if (!mounted) return;
      setState(() => _resendSecondsLeft = _otpTtlSeconds);
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

  String _mapVerifyError(String message, AppLocalizations l10n) {
    final lower = message.toLowerCase();
    if (lower.contains('not registered') ||
        lower.contains('غير مسج') ||
        lower.contains('contact your employer') ||
        lower.contains('تواصل مع الإدارة')) {
      return l10n.emailNotRegisteredWithCompany;
    }
    if (lower.contains('invalid or expired')) {
      return l10n.invalidOrExpiredOtp;
    }
    if (lower.contains('too many attempts')) {
      return l10n.tooManyOtpAttempts;
    }
    return message;
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
                    SizedBox(height: scale.s(16)),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          l10n.didntReceiveCode,
                          style: TextStyle(
                            color: OnboardingTheme.muted,
                            fontSize: scale.s(14),
                          ),
                        ),
                        GestureDetector(
                          onTap: _canResend && !_loading ? _resend : null,
                          child: Text(
                            _canResend
                                ? l10n.resendCode
                                : l10n.resendIn(
                                    _formatCountdown(_resendSecondsLeft),
                                  ),
                            style: TextStyle(
                              color: OnboardingTheme.orange,
                              fontWeight: FontWeight.w600,
                              fontSize: scale.s(14),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    NumericKeypad(
                      keyHeight: scale.s(48),
                      keyFontSize: scale.s(22),
                      onKeyTap: _onKeyTap,
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
