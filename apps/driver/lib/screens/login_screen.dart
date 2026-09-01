import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:tardadi_core/tardadi_core.dart';

import '../l10n/app_localizations.dart';
import '../services/driver_api.dart';
import '../services/firebase_auth_service.dart';
import '../ui/driver_design.dart';
import '../ui/trddk_brand_colors.dart';
import '../ui/trddk_typography.dart';
import 'loading_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _emailFocusNode = FocusNode();
  final _passwordFocusNode = FocusNode();
  final _api = createDriverApi();

  bool _loading = false;
  bool _obscurePassword = true;
  String? _setupMessage;
  String? _emailError;
  String? _passwordError;

  Future<void> _signInWithPassword() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final l10n = context.l10n;

    setState(() {
      _emailError = email.isEmpty ? l10n.enterEmail : null;
      _passwordError = password.isEmpty ? l10n.enterPassword : null;
      _setupMessage = null;
    });
    if (_emailError != null || _passwordError != null) return;

    setState(() => _loading = true);
    try {
      await DriverFirebaseAuth.instance.signIn(email, password);
      final token = await DriverFirebaseAuth.instance.idToken();
      if (token == null || !mounted) return;
      final session = await _api.driverFirebaseLogin(idToken: token);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        driverRoute(builder: (_) => LoadingScreen(session: session)),
      );
    } on FirebaseAuthException catch (e) {
      if (!mounted) return;
      if (e.code == 'wrong-password' || e.code == 'invalid-credential') {
        try {
          final hint = await _api.driverLoginHint(email: email);
          if (!mounted) return;
          if (!hint.requiresPassword) {
            setState(() {
              _setupMessage = l10n.setupInstructions;
              _passwordError = null;
            });
            return;
          }
        } catch (_) {}
      }
      setState(() {
        _passwordError = e.message ?? l10n.loginTitle;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _passwordError = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sendSetupLink() async {
    final email = _emailController.text.trim();
    final l10n = context.l10n;
    if (email.isEmpty) {
      setState(() => _emailError = l10n.enterEmail);
      return;
    }

    setState(() {
      _loading = true;
      _emailError = null;
    });
    try {
      final hint = await _api.driverLoginHint(email: email);
      if (!mounted) return;
      if (hint.requiresPassword) {
        setState(() {
          _setupMessage = l10n.loginSubtitlePassword;
        });
        return;
      }
      await DriverFirebaseAuth.instance.sendPasswordReset(email);
      if (mounted) {
        setState(() => _setupMessage = l10n.setupLinkSent);
      }
    } on FirebaseAuthException catch (e) {
      if (mounted && (e.code == 'user-not-found' || e.code == 'invalid-email')) {
        setState(() => _emailError = l10n.enterEmail);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _emailError = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _forgotPassword() async {
    final email = _emailController.text.trim();
    final l10n = context.l10n;
    if (email.isEmpty) {
      setState(() => _emailError = l10n.enterEmail);
      return;
    }
    try {
      await DriverFirebaseAuth.instance.sendPasswordReset(email);
      if (mounted) DriverSnack.show(context, l10n.resetEmailHint);
    } catch (_) {
      if (mounted) DriverSnack.show(context, l10n.resetEmailHint);
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _emailFocusNode.dispose();
    _passwordFocusNode.dispose();
    super.dispose();
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
                        child: _LoginForm(
                            l10n: l10n,
                            emailController: _emailController,
                            passwordController: _passwordController,
                            emailFocusNode: _emailFocusNode,
                            passwordFocusNode: _passwordFocusNode,
                            loading: _loading,
                            obscurePassword: _obscurePassword,
                            setupMessage: _setupMessage,
                            emailError: _emailError,
                            passwordError: _passwordError,
                            onTogglePassword: () => setState(
                              () => _obscurePassword = !_obscurePassword,
                            ),
                            onEmailChanged: (_) => setState(() {
                              _emailError = null;
                              _setupMessage = null;
                            }),
                            onPasswordChanged: (_) => setState(() {
                              _passwordError = null;
                              _setupMessage = null;
                            }),
                            onForgotPassword: _loading ? null : _forgotPassword,
                            onCreatePassword: _loading ? null : _sendSetupLink,
                          onSignIn: _loading ? null : _signInWithPassword,
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Text(
                          l10n.needHelp,
                          textAlign: TextAlign.center,
                          style: TrddkTypography.text(
                            fontSize: 13,
                            fontWeight: FontWeight.w400,
                            color: TrddkBrandColors.textSecondary,
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
    required this.emailController,
    required this.passwordController,
    required this.emailFocusNode,
    required this.passwordFocusNode,
    required this.loading,
    required this.obscurePassword,
    required this.setupMessage,
    required this.emailError,
    required this.passwordError,
    required this.onTogglePassword,
    required this.onEmailChanged,
    required this.onPasswordChanged,
    required this.onForgotPassword,
    required this.onCreatePassword,
    required this.onSignIn,
  });

  final AppLocalizations l10n;
  final TextEditingController emailController;
  final TextEditingController passwordController;
  final FocusNode emailFocusNode;
  final FocusNode passwordFocusNode;
  final bool loading;
  final bool obscurePassword;
  final String? setupMessage;
  final String? emailError;
  final String? passwordError;
  final VoidCallback onTogglePassword;
  final ValueChanged<String> onEmailChanged;
  final ValueChanged<String> onPasswordChanged;
  final VoidCallback? onForgotPassword;
  final VoidCallback? onCreatePassword;
  final VoidCallback? onSignIn;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
            Text(
              l10n.loginTitle,
              style: TrddkTypography.text(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: TrddkBrandColors.titleNavy,
                height: 1.2,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              l10n.loginSubtitleCredentials,
              style: TrddkTypography.text(
                fontSize: 14,
                fontWeight: FontWeight.w400,
                color: TrddkBrandColors.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),
            _AuthField(
              label: l10n.emailLabel,
              controller: emailController,
              focusNode: emailFocusNode,
              hintText: l10n.emailHint,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              textDirection: TextDirection.ltr,
              prefixIcon: Icons.mail_outline_rounded,
              errorText: emailError,
              onChanged: onEmailChanged,
              onSubmitted: (_) => passwordFocusNode.requestFocus(),
            ),
            const SizedBox(height: 16),
            _AuthField(
              label: l10n.passwordLabel,
              controller: passwordController,
              focusNode: passwordFocusNode,
              hintText: l10n.passwordHint,
              obscureText: obscurePassword,
              textInputAction: TextInputAction.done,
              prefixIcon: Icons.lock_outline_rounded,
              suffixIcon: obscurePassword
                  ? Icons.visibility_outlined
                  : Icons.visibility_off_outlined,
              onSuffixTap: onTogglePassword,
              errorText: passwordError,
              onChanged: onPasswordChanged,
              onSubmitted: (_) {
                if (onSignIn != null) onSignIn!();
              },
            ),
            if (setupMessage != null) ...[
              const SizedBox(height: 8),
              Text(
                setupMessage!,
                style: TrddkTypography.text(
                  fontSize: 13,
                  color: TrddkBrandColors.textSecondary,
                  height: 1.45,
                ),
              ),
            ],
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: TextButton(
                onPressed: onForgotPassword,
                style: TextButton.styleFrom(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 0, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  l10n.forgotPassword,
                  style: TrddkTypography.text(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: TrddkBrandColors.orange,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            _PrimaryButton(
              label: l10n.signIn,
              loading: loading,
              onPressed: onSignIn,
            ),
            const SizedBox(height: 16),
            Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 4,
              children: [
                Text(
                  l10n.noPasswordYet,
                  style: TrddkTypography.text(
                    fontSize: 14,
                    color: TrddkBrandColors.textSecondary,
                  ),
                ),
                GestureDetector(
                  onTap: onCreatePassword,
                  child: Text(
                    l10n.createPassword,
                    style: TrddkTypography.text(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: TrddkBrandColors.orange,
                    ),
                  ),
                ),
              ],
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
    this.obscureText = false,
    this.prefixIcon,
    this.suffixIcon,
    this.onSuffixTap,
    this.errorText,
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
  final bool obscureText;
  final IconData? prefixIcon;
  final IconData? suffixIcon;
  final VoidCallback? onSuffixTap;
  final String? errorText;
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
            obscureText: widget.obscureText,
            onChanged: widget.onChanged,
            onSubmitted: widget.onSubmitted,
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
              suffixIcon: widget.suffixIcon == null
                  ? null
                  : IconButton(
                      onPressed: widget.onSuffixTap,
                      icon: Icon(
                        widget.suffixIcon,
                        size: 20,
                        color: TrddkBrandColors.textSecondary,
                      ),
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
