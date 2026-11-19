import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../screens/account_type_screen.dart';
import '../screens/enter_phone_screen.dart';
import '../services/passenger_api.dart';
import '../services/user_session.dart';
import '../widgets/onboarding/onboarding_theme.dart';
import '../widgets/onboarding/onboarding_typography.dart';

class SettingsPopup extends StatefulWidget {
  const SettingsPopup({
    super.key,
    required this.onClose,
    required this.onChanged,
  });

  final VoidCallback onClose;
  final VoidCallback onChanged;

  static Future<void> show(
    BuildContext context, {
    required VoidCallback onChanged,
  }) {
    return showDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.55),
      builder: (context) => SettingsPopup(
        onClose: () => Navigator.of(context).pop(),
        onChanged: onChanged,
      ),
    );
  }

  @override
  State<SettingsPopup> createState() => _SettingsPopupState();
}

class _SettingsPopupState extends State<SettingsPopup> {
  late AppLanguage _language = UserSession.instance.language;
  // Business only counts once the user has actually signed in.
  late AccountType _mode = UserSession.instance.hasBusinessSession
      ? AccountType.business
      : AccountType.personal;
  var _deleting = false;

  Future<void> _apply() async {
    final navigator = Navigator.of(context);
    await UserSession.instance.setLanguage(_language);
    if (!mounted) return;

    final session = UserSession.instance;
    final wasBusiness = session.hasBusinessSession;
    final currentMode =
        wasBusiness ? AccountType.business : AccountType.personal;

    // Only the language changed: apply it and stay where we are.
    if (_mode == currentMode) {
      widget.onChanged();
      navigator.pop();
      return;
    }

    if (_mode == AccountType.personal) {
      await UserSession.instance.setAccountType(AccountType.personal);
      if (wasBusiness) {
        await UserSession.instance.clearBusinessSession();
      }
      widget.onChanged();
      navigator.pop();
      return;
    }

    // Don't switch to business until the phone login succeeds; backing out
    // of the login keeps the user in public mode.
    navigator.pop();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!navigator.mounted) return;
      navigator.push(
        MaterialPageRoute<void>(
          builder: (_) => const EnterPhoneScreen(),
        ),
      );
    });
  }

  Future<void> _logout() async {
    final navigator = Navigator.of(context);
    await UserSession.instance.logoutBusiness();
    if (!mounted) return;
    navigator.pop();
    navigator.pushAndRemoveUntil(
      MaterialPageRoute<void>(
        builder: (_) => const AccountTypeScreen(),
      ),
      (_) => false,
    );
  }

  Future<bool> _confirm({
    required String title,
    required String message,
    required String confirmLabel,
    bool destructive = false,
  }) {
    final l10n = context.l10n;
    final apple = Theme.of(context).platform == TargetPlatform.iOS ||
        Theme.of(context).platform == TargetPlatform.macOS;
    if (apple) {
      return showCupertinoDialog<bool>(
        context: context,
        builder: (dialogContext) => CupertinoAlertDialog(
          title: Text(title),
          content: Text(message),
          actions: [
            CupertinoDialogAction(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: Text(l10n.cancel),
            ),
            CupertinoDialogAction(
              isDestructiveAction: destructive,
              onPressed: () => Navigator.pop(dialogContext, true),
              child: Text(confirmLabel),
            ),
          ],
        ),
      ).then((value) => value ?? false);
    }
    return showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(l10n.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(
              confirmLabel,
              style: TextStyle(
                color: destructive ? const Color(0xFFFF6B6B) : null,
              ),
            ),
          ),
        ],
      ),
    ).then((value) => value ?? false);
  }

  Future<void> _deleteAccount() async {
    final l10n = context.l10n;
    final confirmed = await _confirm(
      title: l10n.deleteAccountTitle,
      message: l10n.deleteAccountBody,
      confirmLabel: l10n.delete,
      destructive: true,
    );
    if (!confirmed || !mounted) return;

    setState(() => _deleting = true);
    while (mounted) {
      try {
        await createPassengerApi().deletePassengerAccount();
        if (!mounted) return;
        await UserSession.instance.clearBusinessSession();
        if (!mounted) return;
        final navigator = Navigator.of(context);
        navigator.pushAndRemoveUntil(
          MaterialPageRoute<void>(
            builder: (_) => const AccountTypeScreen(),
          ),
          (_) => false,
        );
        ScaffoldMessenger.of(navigator.context).showSnackBar(
          SnackBar(content: Text(l10n.deleteAccountDone)),
        );
        return;
      } catch (error) {
        if (!mounted) return;
        setState(() => _deleting = false);
        final retry = await _confirm(
          title: l10n.deleteAccountFailed,
          message: '$error',
          confirmLabel: l10n.retry,
        );
        if (!retry || !mounted) return;
        setState(() => _deleting = true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final hasBusiness = UserSession.instance.hasBusinessSession;
    // Picking business without a session sends the user to phone sign-in.
    final needsSignIn = _mode == AccountType.business && !hasBusiness;

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
        decoration: BoxDecoration(
          color: OnboardingTheme.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: OnboardingTheme.white.withValues(alpha: 0.08),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    l10n.settings,
                    style: OnboardingTypography.display(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Material(
                  color: Colors.white.withValues(alpha: 0.08),
                  shape: const CircleBorder(),
                  child: InkWell(
                    onTap: widget.onClose,
                    customBorder: const CircleBorder(),
                    child: const SizedBox(
                      width: 32,
                      height: 32,
                      child: Icon(
                        Icons.close_rounded,
                        color: OnboardingTheme.white,
                        size: 18,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            _SectionLabel(l10n.languageTitle),
            const SizedBox(height: 8),
            _SegmentToggle<AppLanguage>(
              values: const [AppLanguage.arabic, AppLanguage.english],
              labels: [l10n.ar, l10n.eng],
              selected: _language,
              onChanged: (value) => setState(() => _language = value),
            ),
            const SizedBox(height: 20),
            _SectionLabel(l10n.accountTypeLabel),
            const SizedBox(height: 8),
            _ModeCard(
              icon: Icons.person_outline_rounded,
              title: l10n.publicMode,
              subtitle: l10n.personalSubtitle,
              selected: _mode == AccountType.personal,
              onTap: () => setState(() => _mode = AccountType.personal),
            ),
            const SizedBox(height: 8),
            _ModeCard(
              icon: Icons.business_rounded,
              title: l10n.business,
              subtitle: l10n.businessSubtitle,
              selected: _mode == AccountType.business,
              onTap: () => setState(() => _mode = AccountType.business),
            ),
            AnimatedSize(
              duration: OnboardingTheme.motionFast,
              curve: OnboardingTheme.motionCurve,
              child: needsSignIn
                  ? Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.phone_iphone_rounded,
                            size: 16,
                            color: OnboardingTheme.muted,
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              l10n.businessSignInHint,
                              style: OnboardingTypography.body(
                                fontSize: 13,
                                color: OnboardingTheme.muted,
                              ),
                            ),
                          ),
                        ],
                      ),
                    )
                  : const SizedBox(width: double.infinity),
            ),
            const SizedBox(height: 20),
            SizedBox(
              height: 50,
              child: ElevatedButton(
                onPressed: _apply,
                style: ElevatedButton.styleFrom(
                  backgroundColor: OnboardingTheme.orange,
                  foregroundColor: OnboardingTheme.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(
                  needsSignIn ? l10n.continueLabel : l10n.save,
                  style: OnboardingTypography.label(fontSize: 15),
                ),
              ),
            ),
            if (hasBusiness)
              TextButton.icon(
                onPressed: _logout,
                style: TextButton.styleFrom(
                  foregroundColor: OnboardingTheme.muted,
                  minimumSize: const Size.fromHeight(46),
                ),
                icon: const Icon(Icons.logout_rounded, size: 18),
                label: Text(
                  l10n.logout,
                  style: OnboardingTypography.label(
                    fontSize: 14,
                    color: OnboardingTheme.muted,
                  ),
                ),
              ),
            if (hasBusiness)
              TextButton.icon(
                onPressed: _deleting ? null : _deleteAccount,
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFFFF6B6B),
                  minimumSize: const Size.fromHeight(36),
                ),
                icon: const Icon(Icons.delete_outline_rounded, size: 16),
                label: Text(
                  l10n.deleteAccount,
                  style: OnboardingTypography.label(
                    fontSize: 13,
                    color: const Color(0xFFFF6B6B),
                  ),
                ),
              ),
            if (!hasBusiness)
              const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: OnboardingTypography.label(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: OnboardingTheme.muted,
      ),
    );
  }
}

class _SegmentToggle<T> extends StatelessWidget {
  const _SegmentToggle({
    required this.values,
    required this.labels,
    required this.selected,
    required this.onChanged,
  });

  final List<T> values;
  final List<String> labels;
  final T selected;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: OnboardingTheme.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.06),
        ),
      ),
      child: Row(
        children: [
          for (var i = 0; i < values.length; i++)
            Expanded(
              child: GestureDetector(
                onTap: () => onChanged(values[i]),
                child: AnimatedContainer(
                  duration: OnboardingTheme.motionFast,
                  curve: OnboardingTheme.motionCurve,
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  decoration: BoxDecoration(
                    color: selected == values[i]
                        ? OnboardingTheme.orange
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    labels[i],
                    style: OnboardingTypography.label(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: selected == values[i]
                          ? OnboardingTheme.white
                          : OnboardingTheme.muted,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ModeCard extends StatelessWidget {
  const _ModeCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: AnimatedContainer(
          duration: OnboardingTheme.motionFast,
          curve: OnboardingTheme.motionCurve,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: OnboardingTheme.background,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected
                  ? OnboardingTheme.orange
                  : Colors.white.withValues(alpha: 0.06),
              width: 1.5,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: selected
                      ? OnboardingTheme.orange.withValues(alpha: 0.15)
                      : Colors.white.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  icon,
                  size: 20,
                  color: selected
                      ? OnboardingTheme.orange
                      : OnboardingTheme.muted,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: OnboardingTypography.body(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: OnboardingTheme.white,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: OnboardingTypography.body(
                        fontSize: 12,
                        color: OnboardingTheme.muted,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              AnimatedContainer(
                duration: OnboardingTheme.motionFast,
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: selected ? OnboardingTheme.orange : Colors.transparent,
                  border: Border.all(
                    color: selected
                        ? OnboardingTheme.orange
                        : OnboardingTheme.muted.withValues(alpha: 0.5),
                    width: 1.5,
                  ),
                ),
                child: selected
                    ? const Icon(
                        Icons.check_rounded,
                        size: 14,
                        color: OnboardingTheme.white,
                      )
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
