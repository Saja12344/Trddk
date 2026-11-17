import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';

class SettingsSection extends StatelessWidget {
  const SettingsSection({
    super.key,
    required this.label,
    required this.child,
    this.isEnglish = true,
  });

  final String label;
  final Widget child;
  final bool isEnglish;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          label.toUpperCase(),
          style: TrddkTokens.sectionLabel(isEnglish: isEnglish),
        ),
        const SizedBox(height: 10),
        child,
      ],
    );
  }
}

class SettingsCard extends StatelessWidget {
  const SettingsCard({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: TrddkTokens.cardFill,
        borderRadius: BorderRadius.circular(TrddkTokens.radiusCard),
        border: Border.all(color: TrddkTokens.cardBorder, width: 1),
      ),
      child: child,
    );
  }
}

class SettingsRow extends StatelessWidget {
  const SettingsRow({
    super.key,
    required this.icon,
    required this.label,
    required this.trailing,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
  });

  final IconData icon;
  final String label;
  final Widget trailing;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        children: [
          Icon(icon, size: 18, color: TrddkTokens.textMuted),
          const SizedBox(width: 10),
          Expanded(
            child: Text(label, style: TrddkTokens.optionLabel()),
          ),
          trailing,
        ],
      ),
    );
  }
}

class SettingsDivider extends StatelessWidget {
  const SettingsDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return const Divider(
      height: 1,
      thickness: 1,
      indent: 16,
      endIndent: 16,
      color: TrddkTokens.divider,
    );
  }
}

class LanguageSegmentedControl extends StatelessWidget {
  const LanguageSegmentedControl({
    super.key,
    required this.leftLabel,
    required this.rightLabel,
    required this.leftSelected,
    required this.onChanged,
    this.expanded = false,
  });

  final String leftLabel;
  final String rightLabel;
  final bool leftSelected;
  final ValueChanged<bool> onChanged;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final control = Container(
      height: 36,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: TrddkTokens.segmentTrack,
        borderRadius: BorderRadius.circular(TrddkTokens.radiusSegment),
      ),
      child: Row(
        children: [
          _SegmentPart(
            label: leftLabel,
            selected: leftSelected,
            onTap: () => onChanged(true),
          ),
          _SegmentPart(
            label: rightLabel,
            selected: !leftSelected,
            onTap: () => onChanged(false),
          ),
        ],
      ),
    );

    if (expanded) {
      return SizedBox(width: double.infinity, child: control);
    }
    return SizedBox(width: 112, child: control);
  }
}

class _SegmentPart extends StatelessWidget {
  const _SegmentPart({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? TrddkTokens.orange : Colors.transparent,
            borderRadius: BorderRadius.circular(11),
          ),
          child: Text(
            label,
            style: TrddkTokens.optionLabel(size: 13).copyWith(
              fontWeight: FontWeight.w600,
              color: selected ? TrddkTokens.textPrimary : TrddkTokens.textMuted,
            ),
          ),
        ),
      ),
    );
  }
}

class RadioOptionRow extends StatelessWidget {
  const RadioOptionRow({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          child: Row(
            children: [
              Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: selected ? TrddkTokens.orange : TrddkTokens.textMuted,
                    width: 1.5,
                  ),
                  color: selected
                      ? TrddkTokens.orange.withValues(alpha: 0.14)
                      : Colors.transparent,
                ),
                alignment: Alignment.center,
                child: selected
                    ? Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: TrddkTokens.orange,
                          shape: BoxShape.circle,
                        ),
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: TrddkTokens.optionLabel().copyWith(
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                    color: selected
                        ? TrddkTokens.textPrimary
                        : TrddkTokens.textSecondary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class TrddkPrimaryButton extends StatelessWidget {
  const TrddkPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.height = 48,
  });

  final String label;
  final VoidCallback? onPressed;
  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      width: double.infinity,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: TrddkTokens.orange,
          foregroundColor: TrddkTokens.textPrimary,
          disabledBackgroundColor: TrddkTokens.purple,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(TrddkTokens.radiusButton),
          ),
          textStyle: TrddkTokens.optionLabel(size: 15),
        ),
        child: Text(label),
      ),
    );
  }
}
