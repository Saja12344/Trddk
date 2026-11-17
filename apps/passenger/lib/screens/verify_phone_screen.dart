import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../l10n/app_localizations.dart';
import '../services/firebase_auth_service.dart';
import '../services/passenger_api.dart';
import '../services/passenger_phone_login.dart';
import '../services/store_review.dart';
import '../services/user_session.dart';
import '../widgets/onboarding/numeric_keypad.dart';
import '../widgets/onboarding/onboarding_scale.dart';
import '../widgets/onboarding/onboarding_theme.dart';
import '../widgets/onboarding/verification_header.dart';
import 'routes_main_screen.dart';

class VerifyPhoneScreen extends StatefulWidget {
  const VerifyPhoneScreen({
    super.key,
    this.phone,
    this.verificationId,
    this.serverOtp = false,
  });

  final String? phone;
  final String? verificationId;
  final bool serverOtp;

  @override
  State<VerifyPhoneScreen> createState() => _VerifyPhoneScreenState();
}

class _VerifyPhoneScreenState extends State<VerifyPhoneScreen> {
  static const _maxDigits = 8;

  final _otpControllers = List.generate(
    _maxDigits,
    (_) => TextEditingController(),
  );
  final _focusNodes = List.generate(_maxDigits, (_) => FocusNode());
  final _api = createPassengerApi();
  var _verifying = false;
  String? _error;
  String? _verificationId;

  bool get _isReview =>
      isPassengerStoreReviewPhone(UserSession.instance.phoneNumber ?? widget.phone ?? '');

  int get _digitCount => _isReview ? 8 : 6;

  @override
  void initState() {
    super.initState();
    _verificationId = widget.verificationId;
    for (final node in _focusNodes) {
      node.canRequestFocus = false;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      FocusManager.instance.primaryFocus?.unfocus();
    });
  }

  @override
  void dispose() {
    for (final controller in _otpControllers) {
      controller.dispose();
    }
    for (final node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  String get _otp =>
      _otpControllers.take(_digitCount).map((c) => c.text).join();

  void _goBack() {
    Navigator.of(context).pop();
  }

  void _onKeyTap(String value) {
    if (_verifying) return;
    if (value == 'back') {
      for (var i = _digitCount - 1; i >= 0; i--) {
        if (_otpControllers[i].text.isNotEmpty) {
          _otpControllers[i].clear();
          setState(() => _error = null);
          return;
        }
      }
      return;
    }

    for (var i = 0; i < _digitCount; i++) {
      if (_otpControllers[i].text.isEmpty) {
        _otpControllers[i].text = value;
        setState(() => _error = null);
        return;
      }
    }
  }

  Future<void> _verify() async {
    if (_verifying || _otp.length != _digitCount) return;
    final phone = UserSession.instance.phoneNumber ?? widget.phone;
    if (_isReview) {
      if (phone == null || !isPassengerStoreReviewPhone(phone)) {
        setState(() => _error = context.l10n.phoneLoginUnavailable);
        return;
      }
      setState(() {
        _verifying = true;
        _error = null;
      });
      final rejected = context.l10n.reviewCodeRejected;
      try {
        final result = await _api.passengerReviewLogin(phone: phone, code: _otp);
        if (result.scope != 'public' || result.sessionToken.isEmpty) {
          throw Exception(rejected);
        }
        await UserSession.instance.setStoreReviewSession(
          phone: phone,
          sessionToken: result.sessionToken,
        );
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute<void>(builder: (_) => const RoutesMainScreen()),
          (_) => false,
        );
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _error = context.l10n.reviewCodeRejected;
          for (final controller in _otpControllers) {
            controller.clear();
          }
        });
      } finally {
        if (mounted) setState(() => _verifying = false);
      }
      return;
    }

    if (widget.serverOtp) {
      if (phone == null) {
        setState(() => _error = context.l10n.otpSendFailed);
        return;
      }
      setState(() {
        _verifying = true;
        _error = null;
      });
      try {
        final result = await _api.passengerVerifyPhoneOtp(phone: phone, code: _otp);
        if (!mounted) return;
        await continuePassengerPhoneSession(context, phone: phone, result: result);
      } catch (error) {
        if (!mounted) return;
        setState(() {
          _error = passengerSmsError(error, context.l10n);
          for (final controller in _otpControllers) {
            controller.clear();
          }
        });
      } finally {
        if (mounted) setState(() => _verifying = false);
      }
      return;
    }

    final verificationId = _verificationId;
    if (phone == null || verificationId == null || verificationId.isEmpty) {
      setState(() => _error = context.l10n.otpSendFailed);
      return;
    }

    setState(() {
      _verifying = true;
      _error = null;
    });
    try {
      await PassengerFirebaseAuth.instance.signInWithSmsCode(
        verificationId: verificationId,
        smsCode: _otp,
      );
      if (!mounted) return;
      await openPassengerBusinessSession(context, phone: phone);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = passengerSmsError(error, context.l10n);
        for (final controller in _otpControllers) {
          controller.clear();
        }
      });
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _resend() async {
    final phone = widget.phone ?? UserSession.instance.phoneNumber;
    if (_verifying || _isReview || phone == null) return;
    if (widget.serverOtp) {
      setState(() {
        _verifying = true;
        _error = null;
      });
      try {
        await _api.passengerStartPhoneLogin(phone: phone);
      } catch (error) {
        if (!mounted) return;
        setState(() => _error = passengerSmsError(error, context.l10n));
      } finally {
        if (mounted) setState(() => _verifying = false);
      }
      return;
    }
    setState(() {
      _verifying = true;
      _error = null;
    });
    final sendFailed = context.l10n.otpSendFailed;
    final done = Completer<String>();
    try {
      await PassengerFirebaseAuth.instance.verifyPhoneNumber(
        phone: phone,
        verificationCompleted: (credential) async {
          try {
            await PassengerFirebaseAuth.instance.signInWithCredential(credential);
            if (!done.isCompleted) done.complete('AUTO');
          } catch (error) {
            if (!done.isCompleted) done.completeError(error);
          }
        },
        verificationFailed: (error) {
          if (!done.isCompleted) done.completeError(error);
        },
        codeSent: (verificationId, _) {
          if (!done.isCompleted) done.complete(verificationId);
        },
        codeAutoRetrievalTimeout: (_) {},
      );
      final verificationId = await done.future.timeout(
        const Duration(seconds: 90),
        onTimeout: () => throw Exception(sendFailed),
      );
      if (!mounted) return;
      if (verificationId == 'AUTO') {
        await openPassengerBusinessSession(context, phone: phone);
        return;
      }
      setState(() => _verificationId = verificationId);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = passengerSmsError(error, context.l10n));
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scale = OnboardingScale(context);
    final l10n = context.l10n;
    final contentWidth =
        MediaQuery.sizeOf(context).width - scale.horizontalPadding * 2;
    final boxWidth = ((contentWidth - (_digitCount - 1) * scale.s(6)) /
            _digitCount)
        .clamp(28.0, scale.otpBoxSize);

    return Scaffold(
      backgroundColor: Colors.white,
      resizeToAvoidBottomInset: false,
      body: Column(
        children: [
          VerificationHeader(scale: scale, onBack: _goBack),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.symmetric(horizontal: scale.horizontalPadding),
              child: Column(
                children: [
                  SizedBox(height: scale.s(20)),
                  Text(
                    l10n.verifyPhoneTitle,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: OnboardingTheme.routeTitle,
                      fontSize: scale.verifyTitleSize,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  SizedBox(height: scale.s(8)),
                  Text(
                    l10n.reviewCodeSubtitle,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: OnboardingTheme.routeMeta,
                      fontSize: scale.verifySubtitleSize,
                      height: 1.4,
                    ),
                  ),
                  SizedBox(height: scale.s(20)),
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: List.generate(
                        _digitCount,
                        (index) => _OtpBox(
                          size: boxWidth,
                          height: scale.otpBoxHeight,
                          fontSize: scale.s(18),
                          controller: _otpControllers[index],
                          focusNode: _focusNodes[index],
                          onChanged: (_) => setState(() {}),
                        ),
                      ),
                    ),
                  ),
                  if (_error != null) ...[
                    SizedBox(height: scale.s(12)),
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: const Color(0xFFE53935),
                        fontSize: scale.s(13),
                      ),
                    ),
                  ],
                  if (!_isReview) ...[
                    SizedBox(height: scale.s(8)),
                    TextButton(
                      onPressed: _verifying ? null : _resend,
                      child: Text(l10n.sendVerificationCode),
                    ),
                  ],
                ],
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              scale.horizontalPadding,
              0,
              scale.horizontalPadding,
              scale.s(8),
            ),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _otp.length == _digitCount && !_verifying
                    ? _verify
                    : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: OnboardingTheme.orange,
                  foregroundColor: OnboardingTheme.white,
                  disabledBackgroundColor:
                      OnboardingTheme.orange.withValues(alpha: 0.45),
                  elevation: 0,
                  padding: EdgeInsets.symmetric(vertical: scale.s(14)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: Text(
                  l10n.verify,
                  style: TextStyle(
                    fontSize: scale.buttonFontSize,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
          NumericKeypad(
            keyHeight: scale.s(46),
            keyFontSize: scale.s(22),
            onKeyTap: _onKeyTap,
          ),
        ],
      ),
    );
  }
}

class _OtpBox extends StatelessWidget {
  const _OtpBox({
    required this.size,
    required this.height,
    required this.fontSize,
    required this.controller,
    required this.focusNode,
    required this.onChanged,
  });

  final double size;
  final double height;
  final double fontSize;
  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: height,
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        readOnly: true,
        showCursor: false,
        keyboardType: TextInputType.none,
        enableInteractiveSelection: false,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: fontSize,
          fontWeight: FontWeight.w700,
          color: OnboardingTheme.routeTitle,
        ),
        decoration: InputDecoration(
          filled: true,
          fillColor: Colors.white,
          contentPadding: EdgeInsets.zero,
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Colors.black, width: 1.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Colors.black, width: 1.5),
          ),
        ),
        onChanged: onChanged,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      ),
    );
  }
}
