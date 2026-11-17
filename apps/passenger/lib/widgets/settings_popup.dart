import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../screens/account_type_screen.dart';
import '../screens/enter_phone_screen.dart';
import '../services/user_session.dart';
import '../widgets/onboarding/onboarding_theme.dart';
import '../widgets/onboarding/onboarding_typography.dart';
import '../widgets/onboarding/tardadi_logo.dart';

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

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 28),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(
            child: IgnorePointer(
              child: Align(
                alignment: Alignment.center,
                child: Opacity(
                  opacity: 0.05,
                  child: Image.asset(
                    'assets/images/logo_icon.png',
                    width: 220,
                    height: 220,
                    fit: BoxFit.contain,
                  ),
                ),
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
            decoration: BoxDecoration(
              color: OnboardingTheme.card,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: OnboardingTheme.white.withValues(alpha: 0.10),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.22),
                  blurRadius: 24,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const TardadiLogoIcon(size: 28),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        l10n.settings,
                        style: OnboardingTypography.display(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: widget.onClose,
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.08),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.close_rounded,
                          color: OnboardingTheme.white,
                          size: 16,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Divider(
                  height: 1,
                  color: Colors.white.withValues(alpha: 0.08),
                ),
                const SizedBox(height: 16),
                _SettingsRow(
                  icon: Icons.translate_rounded,
                  label: l10n.languageTitle,
                  child: _SegmentToggle<AppLanguage>(
                    values: const [AppLanguage.english, AppLanguage.arabic],
                    labels: [l10n.eng, l10n.ar],
                    selected: _language,
                    onChanged: (value) {
                      setState(() => _language = value);
                    },
                  ),
                ),
                const SizedBox(height: 14),
                _SettingsRow(
                  icon: Icons.swap_horiz_rounded,
                  label: l10n.mode,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: OnboardingTheme.background,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.06),
                      ),
                    ),
                    child: Column(
                      children: [
                        _ModeOption(
                          label: l10n.business,
                          selected: _mode == AccountType.business,
                          onTap: () =>
                              setState(() => _mode = AccountType.business),
                        ),
                        Divider(
                          height: 16,
                          color: Colors.white.withValues(alpha: 0.06),
                        ),
                        _ModeOption(
                          label: l10n.publicMode,
                          selected: _mode == AccountType.personal,
                          onTap: () =>
                              setState(() => _mode = AccountType.personal),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                if (UserSession.instance.hasBusinessSession) ...[
                  SizedBox(
                    height: 48,
                    child: OutlinedButton(
                      onPressed: _logout,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: OnboardingTheme.white,
                        side: BorderSide(
                          color: Colors.white.withValues(alpha: 0.18),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                        ),
                      ),
                      child: Text(
                        l10n.logout,
                        style: OnboardingTypography.label(fontSize: 15),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
                SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _apply,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: OnboardingTheme.orange,
                      foregroundColor: OnboardingTheme.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18),
                      ),
                    ),
                    child: Text(
                      l10n.save,
                      style: OnboardingTypography.label(fontSize: 15),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.icon,
    required this.label,
    required this.child,
  });

  final IconData icon;
  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 16, color: OnboardingTheme.orange),
            const SizedBox(width: 6),
            Text(
              label,
              style: OnboardingTypography.label(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: OnboardingTheme.muted,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        child,
      ],
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

class _ModeOption extends StatelessWidget {
  const _ModeOption({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: [
            Container(
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected
                      ? OnboardingTheme.orange
                      : OnboardingTheme.muted,
                  width: 2,
                ),
              ),
              child: selected
                  ? Center(
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: OnboardingTheme.orange,
                          shape: BoxShape.circle,
                        ),
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: OnboardingTypography.body(
                  fontSize: 15,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  color: selected
                      ? OnboardingTheme.white
                      : OnboardingTheme.white.withValues(alpha: 0.82),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
