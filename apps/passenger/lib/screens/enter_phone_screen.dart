import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:tardadi_core/tardadi_core.dart';

import '../services/passenger_api.dart';

import '../l10n/app_localizations.dart';
import '../services/firebase_auth_service.dart';
import '../services/passenger_phone_login.dart';
import '../services/store_review.dart';
import '../services/user_session.dart';
import '../widgets/onboarding/onboarding_scale.dart';
import '../widgets/onboarding/onboarding_theme.dart';
import '../widgets/onboarding/verification_header.dart';
import 'verify_phone_screen.dart';

class EnterPhoneScreen extends StatefulWidget {
  const EnterPhoneScreen({super.key});

  @override
  State<EnterPhoneScreen> createState() => _EnterPhoneScreenState();
}

class _EnterPhoneScreenState extends State<EnterPhoneScreen> {
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController(text: '+966');
  final _phoneFocusNode = FocusNode();
  String? _error;
  var _sending = false;

  String get _codeDigits =>
      _codeController.text.replaceAll(RegExp(r'\D'), '');

  /// National number without a leading 0 (05XXXXXXXX -> 5XXXXXXXX).
  String get _nationalDigits => _phoneController.text
      .replaceAll(RegExp(r'\D'), '')
      .replaceFirst(RegExp(r'^0+'), '');

  bool get _isSaudi => _codeDigits == '966';

  bool get _isValid => _codeDigits.isNotEmpty &&
      (_isSaudi ? _nationalDigits.length == 9 : _nationalDigits.length >= 6);

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    _phoneFocusNode.dispose();
    super.dispose();
  }

  void _goBack() {
    Navigator.of(context).pop();
  }

  Future<void> _continue() async {
    final digits = _nationalDigits;
    if (!_isValid || _sending) {
      if (!_isValid) {
        setState(() => _error = context.l10n.invalidPhone);
      }
      return;
    }

    final phone = '+$_codeDigits$digits';
    if (_isSaudi && isPassengerStoreReviewPhone(digits)) {
      UserSession.instance.setPhoneNumber(phone);
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => const VerifyPhoneScreen(),
        ),
      );
      return;
    }

    setState(() {
      _sending = true;
      _error = null;
    });
    lastPlayServicesPhoneAuthError = null;
    try {
      final verificationId = await _sendFirebaseSms(phone);
      if (!mounted) return;
      UserSession.instance.setPhoneNumber(phone);
      if (verificationId == 'AUTO') {
        await openPassengerBusinessSession(context, phone: phone);
        return;
      }
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => VerifyPhoneScreen(
            phone: phone,
            verificationId: verificationId,
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      final playServicesMissing = !await googlePlayServicesAvailable();
      if (!mounted) return;
      if (playServicesMissing && isPlayServicesPhoneAuthFailure(error)) {
        lastPlayServicesPhoneAuthError = error;
        try {
          await createPassengerApi().passengerStartPhoneLogin(phone: phone);
          if (!mounted) return;
          UserSession.instance.setPhoneNumber(phone);
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => VerifyPhoneScreen(phone: phone, serverOtp: true),
            ),
          );
          return;
        } catch (serverError) {
          if (!mounted) return;
          setState(() => _error = _smsError(serverError));
          return;
        }
      }
      lastPlayServicesPhoneAuthError = null;
      setState(() => _error = _smsError(error));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<String> _sendFirebaseSms(String phone) {
    final done = Completer<String>();
    PassengerFirebaseAuth.instance.verifyPhoneNumber(
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
    return done.future.timeout(
      const Duration(seconds: 90),
      onTimeout: () {
        if (!mounted) {
          throw Exception('Could not send the verification code. Try again.');
        }
        throw Exception('${context.l10n.otpSendFailed}\n(timeout)');
      },
    );
  }

  String _smsError(Object error) {
    return passengerSmsError(error, context.l10n);
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
            VerificationHeader(scale: scale, onBack: _goBack),
            Expanded(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: scale.horizontalPadding),
                child: Column(
                  children: [
                    SizedBox(height: scale.s(20)),
                    Text(
                      l10n.verifyYourNumber,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: OnboardingTheme.routeTitle,
                        fontSize: scale.verifyTitleSize,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: scale.s(8)),
                    Text(
                      l10n.verifyNumberSubtitle,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: OnboardingTheme.routeMeta,
                        fontSize: scale.verifySubtitleSize,
                        height: 1.4,
                      ),
                    ),
                    SizedBox(height: scale.s(24)),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: Text(
                        l10n.phoneNumber,
                        style: TextStyle(
                          color: OnboardingTheme.routeTitle,
                          fontSize: scale.s(14),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    SizedBox(height: scale.s(8)),
                    Directionality(
                      textDirection: TextDirection.ltr,
                      child: Row(
                        children: [
                          SizedBox(
                            width: scale.s(84),
                            child: TextField(
                              controller: _codeController,
                              keyboardType: TextInputType.phone,
                              textAlign: TextAlign.center,
                              inputFormatters: [
                                FilteringTextInputFormatter.allow(
                                  RegExp(r'[0-9+]'),
                                ),
                                LengthLimitingTextInputFormatter(5),
                              ],
                              onChanged: (_) => setState(() => _error = null),
                              style: TextStyle(
                                color: OnboardingTheme.routeTitle,
                                fontSize: scale.s(16),
                                fontWeight: FontWeight.w600,
                              ),
                              decoration: InputDecoration(
                                filled: true,
                                fillColor: const Color(0xFFF5F6FA),
                                isDense: true,
                                contentPadding: EdgeInsets.symmetric(
                                  horizontal: scale.s(8),
                                  vertical: scale.s(16),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide:
                                      const BorderSide(color: Colors.black26),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(
                                    color: Colors.black,
                                    width: 1.5,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          SizedBox(width: scale.s(10)),
                          Expanded(
                            child: TextField(
                              controller: _phoneController,
                              focusNode: _phoneFocusNode,
                              keyboardType: TextInputType.phone,
                              textInputAction: TextInputAction.done,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(14),
                              ],
                              onChanged: (_) => setState(() => _error = null),
                              style: TextStyle(
                                color: OnboardingTheme.routeTitle,
                                fontSize: scale.s(16),
                                fontWeight: FontWeight.w500,
                              ),
                              decoration: InputDecoration(
                                hintText: l10n.phonePlaceholder,
                                hintStyle: TextStyle(
                                  color: OnboardingTheme.routeMeta
                                      .withValues(alpha: 0.7),
                                  fontSize: scale.s(16),
                                  fontWeight: FontWeight.w500,
                                ),
                                filled: true,
                                fillColor: Colors.white,
                                contentPadding: EdgeInsets.symmetric(
                                  horizontal: scale.s(14),
                                  vertical: scale.s(16),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(
                                    color: Colors.black,
                                    width: 1.5,
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(
                                    color: Colors.black,
                                    width: 1.5,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (_error != null) ...[
                      SizedBox(height: scale.s(10)),
                      Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: Text(
                          _error!,
                          style: TextStyle(
                            color: const Color(0xFFE53935),
                            fontSize: scale.s(13),
                          ),
                        ),
                      ),
                    ],
                    const Spacer(),
                    TextButton(
                      onPressed: () => openTardadiSupportEmail(),
                      child: Text(
                        l10n.contactSupport,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: OnboardingTheme.routeMeta,
                          fontSize: scale.s(13),
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                    SizedBox(height: scale.s(16)),
                  ],
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                scale.horizontalPadding,
                0,
                scale.horizontalPadding,
                scale.s(16),
              ),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isValid && !_sending ? _continue : null,
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
                    _sending ? '...' : l10n.next,
                    style: TextStyle(
                      fontSize: scale.buttonFontSize,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
