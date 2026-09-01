import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../l10n/app_localizations.dart';
import '../services/passenger_api.dart';
import '../services/user_session.dart';
import '../ui/trddk_typography.dart';
import '../widgets/onboarding/onboarding_primary_button.dart';
import '../widgets/onboarding/onboarding_scale.dart';
import '../widgets/onboarding/onboarding_theme.dart';
import '../widgets/onboarding/tardadi_logo.dart';
import 'verify_email_otp_screen.dart';

class EnterEmailScreen extends StatefulWidget {
  const EnterEmailScreen({super.key, required this.accountType});

  final AccountType accountType;

  @override
  State<EnterEmailScreen> createState() => _EnterEmailScreenState();
}

class _EnterEmailScreenState extends State<EnterEmailScreen> {
  final _emailController = TextEditingController();
  final _focusNode = FocusNode();
  final _api = createPassengerApi();
  var _loading = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    final email = _emailController.text.trim();
    final l10n = context.l10n;
    if (!email.contains('@') || !email.contains('.')) {
      setState(() => _error = l10n.enterValidEmail);
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _api.passengerSendEmailOtp(email: email);
      if (!mounted) return;
      UserSession.instance.setEmail(email);
      UserSession.instance.setAccountType(widget.accountType);
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => VerifyEmailOtpScreen(email: email),
        ),
      );
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
      backgroundColor: OnboardingTheme.background,
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: scale.horizontalPadding),
          child: Column(
            children: [
              SizedBox(height: scale.s(24)),
              const Center(child: TardadiLogoIcon(size: 40)),
              SizedBox(height: scale.s(24)),
              Text(
                l10n.enterYourEmail,
                textAlign: TextAlign.center,
                style: TrddkTypography.text(
                  color: OnboardingTheme.white,
                  fontSize: scale.s(24),
                  fontWeight: FontWeight.w700,
                ),
              ),
              SizedBox(height: scale.s(8)),
              Text(
                l10n.emailOtpSubtitle,
                textAlign: TextAlign.center,
                style: TrddkTypography.text(
                  color: OnboardingTheme.muted,
                  fontSize: scale.s(14),
                  height: 1.45,
                ),
              ),
              SizedBox(height: scale.s(28)),
              TextField(
                controller: _emailController,
                focusNode: _focusNode,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.done,
                autocorrect: false,
                textDirection: TextDirection.ltr,
                style: TrddkTypography.text(
                  color: OnboardingTheme.white,
                  fontSize: scale.s(16),
                ),
                decoration: InputDecoration(
                  hintText: l10n.emailHint,
                  hintStyle: TrddkTypography.text(
                    color: OnboardingTheme.muted,
                    fontSize: scale.s(16),
                  ),
                  filled: true,
                  fillColor: OnboardingTheme.card,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: scale.s(16),
                    vertical: scale.s(14),
                  ),
                ),
                onSubmitted: (_) => _loading ? null : _sendCode(),
              ),
              if (_error != null) ...[
                SizedBox(height: scale.s(10)),
                Text(
                  _error!,
                  style: TrddkTypography.text(
                    color: const Color(0xFFF87171),
                    fontSize: scale.s(13),
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
              const Spacer(),
              OnboardingPrimaryButton(
                scale: scale,
                label: _loading ? '...' : l10n.sendVerificationCode,
                onPressed: _loading ? () {} : _sendCode,
              ),
              SizedBox(height: scale.s(16)),
            ],
          ),
        ),
      ),
    );
  }
}
