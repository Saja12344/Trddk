import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../l10n/app_localizations.dart';
import '../services/passenger_api.dart';
import '../services/store_review.dart';
import '../services/user_session.dart';
import '../widgets/onboarding/numeric_keypad.dart';
import '../widgets/onboarding/onboarding_scale.dart';
import '../widgets/onboarding/onboarding_theme.dart';
import '../widgets/onboarding/verification_header.dart';
import 'routes_main_screen.dart';

class VerifyPhoneScreen extends StatefulWidget {
  const VerifyPhoneScreen({super.key});

  @override
  State<VerifyPhoneScreen> createState() => _VerifyPhoneScreenState();
}

class _VerifyPhoneScreenState extends State<VerifyPhoneScreen> {
  static const _digitCount = 8;

  final _otpControllers = List.generate(
    _digitCount,
    (_) => TextEditingController(),
  );
  final _focusNodes = List.generate(_digitCount, (_) => FocusNode());
  final _api = createPassengerApi();
  var _verifying = false;
  String? _error;

  @override
  void initState() {
    super.initState();
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

  String get _otp => _otpControllers.map((c) => c.text).join();

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
    final phone = UserSession.instance.phoneNumber;
    if (phone == null || !isPassengerStoreReviewPhone(phone)) {
      setState(() => _error = context.l10n.phoneLoginUnavailable);
      return;
    }

    setState(() {
      _verifying = true;
      _error = null;
    });

    try {
      final result = await _api.passengerReviewLogin(phone: phone, code: _otp);
      if (result.scope != 'public' || result.sessionToken.isEmpty) {
        throw Exception(context.l10n.reviewCodeRejected);
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
