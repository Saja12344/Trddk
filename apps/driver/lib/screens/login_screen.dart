import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:tardadi_core/tardadi_core.dart';

import '../l10n/app_localizations.dart';
import '../services/driver_api.dart';
import '../services/driver_prefs.dart';
import '../services/firebase_auth_service.dart';
import '../ui/trddk_brand_colors.dart';
import '../ui/trddk_typography.dart';
import 'loading_screen.dart';

bool isDriverStoreReviewPhone(String input) {
  final digits = input.replaceAll(RegExp(r'\D'), '');
  return digits == '966500300002' ||
      digits == '500300002' ||
      digits == '0500300002';
}

String _toE164(String input) {
  final digits = input.replaceAll(RegExp(r'\D'), '');
  if (digits.startsWith('966') && digits.length >= 12) {
    return '+$digits';
  }
  if (digits.startsWith('05') && digits.length == 10) {
    return '+966${digits.substring(1)}';
  }
  if (digits.startsWith('5') && digits.length == 9) {
    return '+966$digits';
  }
  if (input.trim().startsWith('+') && digits.isNotEmpty) {
    return '+$digits';
  }
  return digits.isEmpty ? input.trim() : '+$digits';
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

enum _LoginStep { phone, otp }

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController(text: '+966');
  final _otpController = TextEditingController();
  final _phoneFocusNode = FocusNode();
  final _otpFocusNode = FocusNode();
  final _api = createDriverApi();

  _LoginStep _step = _LoginStep.phone;
  bool _loading = false;
  String? _phoneError;
  String? _otpError;
  String? _verificationId;
  int? _resendToken;
  bool _serverOtp = false;
  Object? _playServicesAuthError;
  int _secondsLeft = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _restorePendingOtp();
  }

  Future<void> _restorePendingOtp() async {
    final pending = await DriverPrefs.instance.getPendingOtpPhone();
    if (!mounted || pending == null) return;
    setState(() {
      if (pending.startsWith('+966')) {
        _codeController.text = '+966';
        _phoneController.text = pending.substring(4);
      } else if (pending.startsWith('+')) {
        _codeController.text = '';
        _phoneController.text = pending;
      } else {
        _phoneController.text = pending;
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _phoneController.dispose();
    _codeController.dispose();
    _otpController.dispose();
    _phoneFocusNode.dispose();
    _otpFocusNode.dispose();
    super.dispose();
  }

  void _startResendTimer() {
    _timer?.cancel();
    setState(() => _secondsLeft = 60);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_secondsLeft <= 1) {
        timer.cancel();
        setState(() => _secondsLeft = 0);
        return;
      }
      setState(() => _secondsLeft--);
    });
  }

  /// Full number from the editable country code (default +966) and the
  /// national number. A leading 0 (e.g. 05XXXXXXXX) is dropped.
  String get _fullPhone {
    final code = _codeController.text.replaceAll(RegExp(r'\D'), '');
    final raw = _phoneController.text.trim();
    if (code.isEmpty || raw.startsWith('+')) return _toE164(raw);
    final national =
        raw.replaceAll(RegExp(r'\D'), '').replaceFirst(RegExp(r'^0+'), '');
    if (national.isEmpty) return '';
    return '+$code$national';
  }

  Future<void> _signIn() async {
    final phone = _phoneController.text.trim().isEmpty ? '' : _fullPhone;

    setState(() {
      _phoneError = phone.isEmpty ? context.l10n.enterPhone : null;
    });
    if (_phoneError != null) return;

    if (isDriverStoreReviewPhone(phone)) {
      setState(() {
        _step = _LoginStep.otp;
        _otpError = null;
        _loading = false;
      });
      _otpFocusNode.requestFocus();
      return;
    }

    setState(() => _loading = true);
    _serverOtp = false;
    _playServicesAuthError = null;
    try {
      await _sendFirebaseSms(phone);
    } catch (e) {
      if (!mounted) return;
      final started = await _fallbackToServerOtp(phone, e, onOtpStep: false);
      if (!mounted || started) return;
      setState(() {
        _phoneError = _shownLoginError(e);
        _loading = false;
      });
    }
  }

  /// Server SMS only after Firebase fails for a Play Services reason on a
  /// device that does not have Play Services. Returns true when the OTP
  /// screen was opened.
  Future<bool> _fallbackToServerOtp(
    String phone,
    Object firebaseError, {
    required bool onOtpStep,
  }) async {
    if (!_isPlayServicesAuthFailure(firebaseError)) return false;
    if (await googlePlayServicesAvailable()) return false;
    if (!mounted) return false;
    _playServicesAuthError = firebaseError;
    try {
      await _api.driverStartLogin(phone: phone);
    } catch (serverError) {
      if (!mounted) return true;
      final message = _shownLoginError(serverError);
      setState(() {
        if (onOtpStep) {
          _otpError = message;
        } else {
          _phoneError = message;
        }
        _loading = false;
        _serverOtp = false;
      });
      return true;
    }
    if (!mounted) return true;
    setState(() {
      _serverOtp = true;
      _step = _LoginStep.otp;
      _otpError = null;
      _loading = false;
    });
    _startResendTimer();
    _otpFocusNode.requestFocus();
    return true;
  }

  Future<void> _sendFirebaseSms(String phone) async {
    final done = Completer<void>();
    await DriverFirebaseAuth.instance.verifyPhoneNumber(
      phone: phone,
      forceResendingToken: _resendToken,
      verificationCompleted: (credential) {
        if (!done.isCompleted) done.complete();
        unawaited(_completeWithCredential(credential));
      },
      verificationFailed: (error) {
        if (!done.isCompleted) done.completeError(error);
      },
      codeSent: (verificationId, resendToken) {
        _verificationId = verificationId;
        _resendToken = resendToken;
        if (!done.isCompleted) done.complete();
        if (!mounted) return;
        setState(() {
          _step = _LoginStep.otp;
          _otpError = null;
          _loading = false;
        });
        unawaited(DriverPrefs.instance.savePendingOtp(phone: phone));
        _startResendTimer();
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _otpFocusNode.requestFocus();
        });
      },
      codeAutoRetrievalTimeout: (verificationId) {
        _verificationId = verificationId;
      },
    );
    final sendFailed = context.l10n.otpSendFailed;
    await done.future.timeout(
      const Duration(seconds: 90),
      onTimeout: () => throw Exception('$sendFailed\n(timeout)'),
    );
  }

  Future<void> _completeWithCredential(PhoneAuthCredential credential) async {
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      await DriverFirebaseAuth.instance.signInWithCredential(credential);
      await _openDriverSession();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _otpError = _loginError(e);
        _loading = false;
      });
    }
  }

  Future<void> _openDriverSession() async {
    final token = await DriverFirebaseAuth.instance.idToken();
    if (!mounted) return;
    if (token == null || token.isEmpty) {
      throw Exception(context.l10n.invalidOtp);
    }
    final session = await _api.driverFirebaseLogin(idToken: token);
    await DriverPrefs.instance.clearPendingOtp();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => LoadingScreen(session: session),
      ),
    );
  }

  Future<void> _verifyOtp() async {
    final code = _otpController.text.trim();
    if (isDriverStoreReviewPhone(_fullPhone)) {
      await _verifyReviewCode(code);
      return;
    }

    if (_serverOtp) {
      if (code.length != 6) {
        setState(() => _otpError = context.l10n.enterOtp);
        return;
      }
      setState(() {
        _loading = true;
        _otpError = null;
      });
      try {
        final session = await _api.driverVerifyOtp(phone: _fullPhone, code: code);
        await DriverPrefs.instance.clearPendingOtp();
        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => LoadingScreen(session: session),
          ),
        );
      } catch (e) {
        if (!mounted) return;
        setState(() {
          _otpError = _loginError(e);
          _loading = false;
        });
      }
      return;
    }

    final verificationId = _verificationId;

    if (code.length != 6) {
      setState(() => _otpError = context.l10n.enterOtp);
      return;
    }
    if (verificationId == null) {
      setState(() => _otpError = context.l10n.invalidOtp);
      return;
    }

    setState(() {
      _loading = true;
      _otpError = null;
    });

    try {
      await DriverFirebaseAuth.instance.signInWithSmsCode(
        verificationId: verificationId,
        smsCode: code,
      );
      await _openDriverSession();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _otpError = _loginError(e);
        _loading = false;
      });
    }
  }

  Future<void> _verifyReviewCode(String code) async {
    if (code.length != 8) {
      setState(() => _otpError = context.l10n.enterOtp);
      return;
    }

    setState(() {
      _loading = true;
      _otpError = null;
    });
    try {
      final session = await _api.driverReviewLogin(
        phone: _fullPhone,
        code: code,
      );
      await DriverPrefs.instance.clearPendingOtp();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => LoadingScreen(session: session),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _otpError = context.l10n.invalidOtp;
        _loading = false;
      });
    }
  }

  Future<void> _resendCode() async {
    if (isDriverStoreReviewPhone(_fullPhone)) return;
    if (_secondsLeft > 0 || _loading) return;
    setState(() {
      _loading = true;
      _otpError = null;
    });
    try {
      if (_serverOtp) {
        await _api.driverStartLogin(phone: _fullPhone);
        if (!mounted) return;
        setState(() => _loading = false);
        _startResendTimer();
        return;
      }
      await _sendFirebaseSms(_fullPhone);
      if (!mounted) return;
      setState(() => _loading = false);
    } catch (e) {
      if (!mounted) return;
      if (!_serverOtp) {
        final started = await _fallbackToServerOtp(
          _fullPhone,
          e,
          onOtpStep: true,
        );
        if (!mounted || started) return;
      }
      setState(() {
        _otpError = _shownLoginError(e);
        _loading = false;
      });
    }
  }

  void _backToPhone() {
    _timer?.cancel();
    unawaited(DriverPrefs.instance.clearPendingOtp());
    setState(() {
      _step = _LoginStep.phone;
      _otpController.clear();
      _otpError = null;
      _verificationId = null;
      _serverOtp = false;
      _playServicesAuthError = null;
      _loading = false;
      _secondsLeft = 0;
    });
  }

  bool _isSmsProviderMissing(Object error) {
    final raw = error.toString();
    return raw.contains('SMS_PROVIDER_MISSING') ||
        raw.contains('تعذّر إرسال رمز التحقق') ||
        raw.contains('تعذر إرسال رمز التحقق');
  }

  bool _isPlayServicesAuthFailure(Object error) {
    final code = error is FirebaseAuthException ? error.code.toLowerCase() : '';
    final raw = error.toString().toLowerCase();
    final haystack = '$code $raw';
    const markers = [
      'missing-client-identifier',
      'app-not-authorized',
      'captcha-check-failed',
      'invalid-app-credential',
      'play-integrity',
      'play_integrity',
      'play services',
      'playservices',
      'googleapiavailability',
      'service_missing',
      'service_invalid',
      'service_disabled',
      'service_version_update_required',
      '(timeout)',
    ];
    return markers.any(haystack.contains);
  }

  String _shownLoginError(Object error) {
    final original = _playServicesAuthError;
    if (original != null &&
        !identical(original, error) &&
        _isSmsProviderMissing(error)) {
      return _loginError(original);
    }
    return _loginError(error);
  }

  String _loginError(Object error) {
    final raw = error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
    final firebaseCode = error is FirebaseAuthException ? error.code : '';
    final trailing = RegExp(r'\n\(([^)\n]+)\)\s*$').firstMatch(raw);
    final trailingCode = trailing?.group(1) ?? '';
    final visibleRaw = trailing == null
        ? raw.trim()
        : raw.substring(0, trailing.start).trim();
    final lookup = firebaseCode.isNotEmpty ? firebaseCode : raw;

    String present(String message, String code) {
      if (code.isNotEmpty) debugPrint('driver login error: $code');
      if (kDebugMode && code.isNotEmpty) return '$message\n($code)';
      return message;
    }

    if (lookup.contains('invalid-phone-number') ||
        raw.contains('badly formatted') ||
        raw.contains('invalid-email')) {
      if (firebaseCode.isNotEmpty) debugPrint('driver login error: $firebaseCode');
      return context.l10n.enterPhone;
    }
    if (lookup.contains('too-many-requests') || lookup.contains('quota')) {
      return present(
        context.l10n.otpQuota,
        firebaseCode.isNotEmpty ? firebaseCode : 'quota',
      );
    }
    if (lookup.contains('invalid-verification-code') ||
        lookup.contains('invalid-verification-id') ||
        lookup.contains('session-expired')) {
      if (firebaseCode.isNotEmpty) debugPrint('driver login error: $firebaseCode');
      return context.l10n.invalidOtp;
    }
    if (raw.contains('تعذّر إرسال رمز التحقق') ||
        raw.contains('تعذر إرسال رمز التحقق')) {
      return present(context.l10n.otpSendFailed, 'SMS_PROVIDER_MISSING');
    }
    if (lookup.contains('missing-client-identifier') ||
        lookup.contains('app-not-authorized') ||
        lookup.contains('captcha-check-failed')) {
      return present(
        context.l10n.otpSendFailed,
        firebaseCode.isNotEmpty ? firebaseCode : trailingCode,
      );
    }
    if (visibleRaw.isEmpty) {
      return present(
        context.l10n.otpSendFailed,
        firebaseCode.isNotEmpty ? firebaseCode : trailingCode,
      );
    }
    if (trailingCode.isNotEmpty) return present(visibleRaw, trailingCode);
    if (firebaseCode.isNotEmpty) return present(visibleRaw, firebaseCode);
    return visibleRaw;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: Colors.white,
        resizeToAvoidBottomInset: true,
        body: SafeArea(
          top: false,
          bottom: false,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final canPop = Navigator.of(context).canPop();
              return SingleChildScrollView(
                padding: EdgeInsets.only(bottom: bottomInset + 24),
                physics: const ClampingScrollPhysics(),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: Column(
                    children: [
                      _AuthHeader(
                        canPop: canPop,
                        onBack: canPop
                            ? () => Navigator.of(context).maybePop()
                            : null,
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(
                          TrddkBrandColors.cardMargin,
                          28,
                          TrddkBrandColors.cardMargin,
                          24,
                        ),
                        child: _step == _LoginStep.phone
                            ? _LoginForm(
                                l10n: l10n,
                                phoneController: _phoneController,
                                codeController: _codeController,
                                phoneFocusNode: _phoneFocusNode,
                                loading: _loading,
                                phoneError: _phoneError,
                                onPhoneChanged: (_) => setState(() {
                                  _phoneError = null;
                                }),
                                onSignIn: _loading ? null : _signIn,
                              )
                            : _OtpForm(
                                l10n: l10n,
                                phone: _fullPhone,
                                codeLength: isDriverStoreReviewPhone(
                                  _fullPhone,
                                )
                                    ? 8
                                    : 6,
                                otpController: _otpController,
                                otpFocusNode: _otpFocusNode,
                                loading: _loading,
                                otpError: _otpError,
                                secondsLeft: _secondsLeft,
                                onOtpChanged: (_) => setState(() {
                                  _otpError = null;
                                }),
                                onVerify: _loading ? null : _verifyOtp,
                                onResend: _secondsLeft > 0 || _loading
                                    ? null
                                    : _resendCode,
                                onChangePhone: _loading ? null : _backToPhone,
                              ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: TextButton(
                          onPressed: () => openTardadiSupportEmail(),
                          child: Text(
                            l10n.needHelp,
                            textAlign: TextAlign.center,
                            style: TrddkTypography.text(
                              fontSize: 13,
                              fontWeight: FontWeight.w400,
                              color: TrddkBrandColors.textSecondary,
                            ).copyWith(decoration: TextDecoration.underline),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _AuthHeader extends StatelessWidget {
  const _AuthHeader({
    required this.canPop,
    this.onBack,
  });

  final bool canPop;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;

    return Container(
      height: top + TrddkBrandColors.headerHeight,
      width: double.infinity,
      decoration: const BoxDecoration(
        color: TrddkBrandColors.navy,
        borderRadius: BorderRadius.vertical(
          bottom: Radius.circular(TrddkBrandColors.headerRadius),
        ),
      ),
      padding: EdgeInsets.fromLTRB(16, top + 8, 16, 20),
      child: Column(
        children: [
          SizedBox(
            height: 40,
            child: Stack(
              alignment: Alignment.center,
              children: [
                if (canPop)
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: Material(
                      color: const Color(0xFF1A2455),
                      shape: const CircleBorder(),
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: onBack,
                        child: const SizedBox(
                          width: 40,
                          height: 40,
                          child: Icon(
                            Icons.arrow_back_ios_new_rounded,
                            color: Colors.white,
                            size: 18,
                          ),
                        ),
                      ),
                    ),
                  ),
                const TrddkBrandLockup(height: 36),
              ],
            ),
          ),
          const Spacer(),
        ],
      ),
    );
  }
}

class _LoginForm extends StatelessWidget {
  const _LoginForm({
    required this.l10n,
    required this.phoneController,
    required this.codeController,
    required this.phoneFocusNode,
    required this.loading,
    required this.phoneError,
    required this.onPhoneChanged,
    required this.onSignIn,
  });

  final AppLocalizations l10n;
  final TextEditingController phoneController;
  final TextEditingController codeController;
  final FocusNode phoneFocusNode;
  final bool loading;
  final String? phoneError;
  final ValueChanged<String> onPhoneChanged;
  final VoidCallback? onSignIn;

  @override
  Widget build(BuildContext context) {
    // Same layout as the passenger "Verify your number" screen.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l10n.loginTitle,
          textAlign: TextAlign.center,
          style: TrddkTypography.text(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: TrddkBrandColors.titleNavy,
            height: 1.2,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          l10n.loginSubtitleCredentials,
          textAlign: TextAlign.center,
          style: TrddkTypography.text(
            fontSize: 14,
            fontWeight: FontWeight.w400,
            color: TrddkBrandColors.textSecondary,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 24),
        Text(
          l10n.phoneNumber,
          style: TrddkTypography.text(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: TrddkBrandColors.titleNavy,
          ),
        ),
        const SizedBox(height: 8),
        Directionality(
          textDirection: TextDirection.ltr,
          child: Row(
            children: [
              SizedBox(
                width: 88,
                child: TextField(
                  controller: codeController,
                  keyboardType: TextInputType.phone,
                  textAlign: TextAlign.center,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9+]')),
                    LengthLimitingTextInputFormatter(5),
                  ],
                  onChanged: onPhoneChanged,
                  style: TrddkTypography.text(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: TrddkBrandColors.titleNavy,
                  ),
                  decoration: _phoneInputDecoration(
                    fill: const Color(0xFFF5F6FA),
                    borderColor: Colors.black26,
                    hasError: phoneError != null,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: phoneController,
                  focusNode: phoneFocusNode,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.done,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(14),
                  ],
                  onChanged: onPhoneChanged,
                  onSubmitted: (_) {
                    if (onSignIn != null) onSignIn!();
                  },
                  style: TrddkTypography.text(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: TrddkBrandColors.titleNavy,
                  ),
                  decoration: _phoneInputDecoration(
                    fill: Colors.white,
                    borderColor: Colors.black,
                    hasError: phoneError != null,
                    hint: l10n.enterPhoneNumber,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (phoneError != null) ...[
          const SizedBox(height: 10),
          Text(
            phoneError!,
            style: TrddkTypography.text(
              fontSize: 13,
              color: TrddkBrandColors.error,
            ),
          ),
        ],
        const SizedBox(height: 28),
        _PrimaryButton(
          label: l10n.sendCode,
          loading: loading,
          onPressed: onSignIn,
        ),
      ],
    );
  }
}

InputDecoration _phoneInputDecoration({
  required Color fill,
  required Color borderColor,
  required bool hasError,
  String? hint,
}) {
  final color = hasError ? TrddkBrandColors.error : borderColor;
  OutlineInputBorder border(Color c) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: c, width: 1.5),
      );
  return InputDecoration(
    hintText: hint,
    hintStyle: TrddkTypography.text(
      fontSize: 16,
      fontWeight: FontWeight.w500,
      color: TrddkBrandColors.textSecondary.withValues(alpha: 0.7),
    ),
    filled: true,
    fillColor: fill,
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
    enabledBorder: border(color),
    focusedBorder: border(hasError ? TrddkBrandColors.error : TrddkBrandColors.orange),
    border: border(color),
  );
}

class _OtpForm extends StatelessWidget {
  const _OtpForm({
    required this.l10n,
    required this.phone,
    required this.otpController,
    required this.otpFocusNode,
    required this.loading,
    required this.otpError,
    required this.secondsLeft,
    required this.onOtpChanged,
    required this.onVerify,
    required this.onResend,
    required this.onChangePhone,
    this.codeLength = 6,
  });

  final AppLocalizations l10n;
  final String phone;
  final int codeLength;
  final TextEditingController otpController;
  final FocusNode otpFocusNode;
  final bool loading;
  final String? otpError;
  final int secondsLeft;
  final ValueChanged<String> onOtpChanged;
  final VoidCallback? onVerify;
  final VoidCallback? onResend;
  final VoidCallback? onChangePhone;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l10n.verifyYourPhoneNumber,
          style: TrddkTypography.text(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: TrddkBrandColors.titleNavy,
            height: 1.2,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          l10n.enterSixDigitCode,
          style: TrddkTypography.text(
            fontSize: 14,
            fontWeight: FontWeight.w400,
            color: TrddkBrandColors.textSecondary,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          phone,
          textDirection: TextDirection.ltr,
          style: TrddkTypography.text(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: TrddkBrandColors.titleNavy,
          ),
        ),
        const SizedBox(height: 20),
        _AuthField(
          label: l10n.enterOtp,
          controller: otpController,
          focusNode: otpFocusNode,
          hintText: codeLength == 8 ? '••••••••' : '••••••',
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.done,
          textDirection: TextDirection.ltr,
          prefixIcon: Icons.lock_outline_rounded,
          errorText: otpError,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(codeLength),
          ],
          onChanged: onOtpChanged,
          onSubmitted: (_) {
            if (onVerify != null) onVerify!();
          },
        ),
        const SizedBox(height: 24),
        _PrimaryButton(
          label: loading ? l10n.verifying : l10n.verify,
          loading: loading,
          onPressed: onVerify,
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Text(
              l10n.didntReceiveCode,
              style: TrddkTypography.text(
                fontSize: 13,
                color: TrddkBrandColors.textSecondary,
              ),
            ),
            if (onResend == null && secondsLeft > 0)
              Text(
                l10n.resendIn(secondsLeft.toString().padLeft(2, '0')),
                style: TrddkTypography.text(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: TrddkBrandColors.titleNavy,
                ),
              )
            else
              TextButton(
                onPressed: onResend,
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  l10n.resendCode,
                  style: TrddkTypography.text(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: TrddkBrandColors.orange,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton(
            onPressed: onChangePhone,
            style: TextButton.styleFrom(
              padding: EdgeInsets.zero,
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              l10n.changePhone,
              style: TrddkTypography.text(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: TrddkBrandColors.titleNavy,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _AuthField extends StatefulWidget {
  const _AuthField({
    required this.label,
    required this.controller,
    required this.focusNode,
    required this.hintText,
    this.keyboardType,
    this.textInputAction,
    this.textDirection,
    this.prefixIcon,
    this.errorText,
    this.inputFormatters,
    this.onChanged,
    this.onSubmitted,
  });

  final String label;
  final TextEditingController controller;
  final FocusNode focusNode;
  final String hintText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final TextDirection? textDirection;
  final IconData? prefixIcon;
  final String? errorText;
  final List<TextInputFormatter>? inputFormatters;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  State<_AuthField> createState() => _AuthFieldState();
}

class _AuthFieldState extends State<_AuthField> {
  @override
  void initState() {
    super.initState();
    widget.focusNode.addListener(_onFocusChange);
  }

  @override
  void dispose() {
    widget.focusNode.removeListener(_onFocusChange);
    super.dispose();
  }

  void _onFocusChange() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final focused = widget.focusNode.hasFocus;
    final borderColor = widget.errorText != null
        ? TrddkBrandColors.error
        : focused
            ? TrddkBrandColors.orange
            : TrddkBrandColors.border;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          widget.label,
          style: TrddkTypography.text(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: TrddkBrandColors.titleNavy,
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: TrddkBrandColors.fieldHeight,
          child: TextField(
            controller: widget.controller,
            focusNode: widget.focusNode,
            keyboardType: widget.keyboardType,
            textInputAction: widget.textInputAction,
            textDirection: widget.textDirection,
            onChanged: widget.onChanged,
            onSubmitted: widget.onSubmitted,
            inputFormatters: widget.inputFormatters,
            style: TrddkTypography.text(
              fontSize: 16,
              fontWeight: FontWeight.w500,
              color: TrddkBrandColors.titleNavy,
            ),
            decoration: InputDecoration(
              filled: true,
              fillColor: Colors.white,
              hintText: widget.hintText,
              hintStyle: TrddkTypography.text(
                fontSize: 15,
                fontWeight: FontWeight.w400,
                color: const Color(0xFF9CA3AF),
              ),
              prefixIcon: widget.prefixIcon == null
                  ? null
                  : Icon(
                      widget.prefixIcon,
                      size: 20,
                      color: focused
                          ? TrddkBrandColors.orange
                          : TrddkBrandColors.textSecondary,
                    ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14),
              enabledBorder: OutlineInputBorder(
                borderRadius:
                    BorderRadius.circular(TrddkBrandColors.fieldRadius),
                borderSide: BorderSide(color: borderColor),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius:
                    BorderRadius.circular(TrddkBrandColors.fieldRadius),
                borderSide: BorderSide(color: borderColor, width: 1.5),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius:
                    BorderRadius.circular(TrddkBrandColors.fieldRadius),
                borderSide: const BorderSide(color: TrddkBrandColors.error),
              ),
              focusedErrorBorder: OutlineInputBorder(
                borderRadius:
                    BorderRadius.circular(TrddkBrandColors.fieldRadius),
                borderSide:
                    const BorderSide(color: TrddkBrandColors.error, width: 1.5),
              ),
            ),
          ),
        ),
        if (widget.errorText != null) ...[
          const SizedBox(height: 6),
          Text(
            widget.errorText!,
            style: TrddkTypography.text(
              fontSize: 13,
              color: TrddkBrandColors.error,
              height: 1.3,
            ),
          ),
        ],
      ],
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.label,
    required this.loading,
    this.onPressed,
  });

  final String label;
  final bool loading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !loading;

    return SizedBox(
      height: TrddkBrandColors.buttonHeight,
      width: double.infinity,
      child: ElevatedButton(
        onPressed: enabled ? onPressed : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: TrddkBrandColors.orange,
          disabledBackgroundColor:
              TrddkBrandColors.orange.withValues(alpha: 0.45),
          foregroundColor: Colors.white,
          disabledForegroundColor: Colors.white.withValues(alpha: 0.85),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius:
                BorderRadius.circular(TrddkBrandColors.fieldRadius),
          ),
        ),
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.2,
                  color: Colors.white,
                ),
              )
            : Text(
                label,
                style: TrddkTypography.text(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
      ),
    );
  }
}
