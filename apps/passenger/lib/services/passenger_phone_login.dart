import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:tardadi_core/tardadi_core.dart';

import '../l10n/app_localizations.dart';
import '../screens/company_selection_screen.dart';
import '../screens/routes_main_screen.dart';
import 'firebase_auth_service.dart';
import 'passenger_api.dart';
import 'user_session.dart';

Future<void> openPassengerBusinessSession(
  BuildContext context, {
  required String phone,
}) async {
  final l10n = context.l10n;
  final token = await PassengerFirebaseAuth.instance.idToken();
  if (token == null || token.isEmpty) {
    throw Exception(l10n.reviewCodeRejected);
  }
  final api = createPassengerApi();
  final result = await api.passengerPhoneLogin(idToken: token);
  if (!context.mounted) return;
  await continuePassengerPhoneSession(
    context,
    phone: phone,
    result: result,
  );
}

Future<void> continuePassengerPhoneSession(
  BuildContext context, {
  required String phone,
  required PassengerOtpVerifyResult result,
}) async {
  final l10n = context.l10n;
  final verification = result.verificationToken;
  final memberships = result.memberships;
  if (verification == null || memberships.isEmpty) {
    throw Exception(l10n.phoneNotRegistered);
  }
  if (!context.mounted) return;
  final api = createPassengerApi();
  if (memberships.length == 1) {
    final session = await api.passengerBusinessSession(
      verificationToken: verification,
      businessId: memberships.first.businessId,
    );
    final identity = session.email.isNotEmpty
        ? session.email
        : (session.phone.isNotEmpty ? session.phone : phone);
    await UserSession.instance.setBusinessSession(
      email: identity,
      phone: session.phone.isNotEmpty ? session.phone : phone,
      businessId: session.businessId,
      businessName: session.businessName,
      sessionToken: session.sessionToken,
    );
    if (!context.mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const RoutesMainScreen()),
      (_) => false,
    );
    return;
  }
  Navigator.of(context).pushAndRemoveUntil(
    MaterialPageRoute<void>(
      builder: (_) => CompanySelectionScreen(
        email: phone,
        verificationToken: verification,
        memberships: memberships,
      ),
    ),
    (_) => false,
  );
}

/// Firebase failure that sent this device to server OTP. Kept so a missing
/// SMS provider shows that Firebase code instead of SMS_PROVIDER_MISSING.
Object? lastPlayServicesPhoneAuthError;

bool isSmsProviderMissingError(Object error) {
  final raw = error.toString();
  return raw.contains('SMS_PROVIDER_MISSING') ||
      raw.contains('تعذّر إرسال رمز التحقق') ||
      raw.contains('تعذر إرسال رمز التحقق');
}

/// Play Services / Play Integrity failures, plus the app's 90s send timeout.
bool isPlayServicesPhoneAuthFailure(Object error) {
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

String passengerSmsError(Object error, AppLocalizations l10n) {
  final original = lastPlayServicesPhoneAuthError;
  if (original != null &&
      !identical(original, error) &&
      isSmsProviderMissingError(error)) {
    return passengerSmsErrorBody(original, l10n);
  }
  return passengerSmsErrorBody(error, l10n);
}

String passengerSmsErrorBody(Object error, AppLocalizations l10n) {
  var raw = error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
  final firebaseCode = error is FirebaseAuthException ? error.code : '';
  String withCode(String message, String code) {
    if (code.isNotEmpty) debugPrint('passenger phone login error: $code');
    if (kDebugMode && code.isNotEmpty) return '$message\n($code)';
    return message;
  }

  final trailing = RegExp(r'\n\(([^)\n]+)\)\s*$').firstMatch(raw);
  final trailingCode = trailing?.group(1) ?? '';
  if (trailing != null) {
    raw = raw.substring(0, trailing.start);
  }

  if (raw.contains('تعذّر إرسال رمز التحقق') ||
      raw.contains('تعذر إرسال رمز التحقق')) {
    return withCode(l10n.otpSendFailed, 'SMS_PROVIDER_MISSING');
  }
  if (raw.contains('غير مسجل') ||
      raw.contains('not registered') ||
      raw.contains(l10n.phoneNotRegistered)) {
    return withCode(l10n.phoneNotRegistered, firebaseCode);
  }
  if (raw.contains('محاولات كثيرة') ||
      raw.contains('too-many-requests') ||
      raw.contains('Too many') ||
      raw.contains('quota')) {
    return withCode(l10n.tooManyAttempts, firebaseCode.isEmpty ? 'quota' : firebaseCode);
  }
  if (raw.contains('invalid-verification-code') ||
      raw.contains('invalid-verification-id') ||
      raw.contains('session-expired') ||
      raw.contains('غير صحيح')) {
    return withCode(l10n.reviewCodeRejected, firebaseCode);
  }
  if (raw.contains('invalid-phone-number')) {
    return withCode(l10n.invalidPhone, firebaseCode);
  }
  if (firebaseCode == 'missing-client-identifier' ||
      firebaseCode == 'app-not-authorized' ||
      firebaseCode == 'captcha-check-failed') {
    return withCode(l10n.otpSendFailed, firebaseCode);
  }
  final visible = raw.trim();
  final code = firebaseCode.isNotEmpty ? firebaseCode : trailingCode;
  if (visible.isEmpty) return withCode(l10n.otpSendFailed, code);
  if (code.isNotEmpty) return withCode(visible, code);
  return visible;
}
