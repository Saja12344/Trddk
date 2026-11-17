import 'dart:io' show Platform;

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import 'driver_design.dart';

bool _isApplePlatform(BuildContext context) {
  return Platform.isIOS ||
      Platform.isMacOS ||
      Theme.of(context).platform == TargetPlatform.iOS ||
      Theme.of(context).platform == TargetPlatform.macOS;
}

/// Parses the major OS version from [Platform.operatingSystemVersion].
int? _osMajorVersion() {
  try {
    final match = RegExp(r'(\d+)').firstMatch(Platform.operatingSystemVersion);
    return match != null ? int.tryParse(match.group(1)!) : null;
  } catch (_) {
    return null;
  }
}

bool _useModernAppleDialog() {
  if (!Platform.isIOS && !Platform.isMacOS) return false;
  final major = _osMajorVersion();
  // CupertinoAlertDialog is supported on all Flutter iOS targets; iOS 13+ matches
  // the current system alert chrome. Older devices keep the same API (no forced OS update).
  return major == null || major >= 13;
}

bool _useModernAndroidDialog() {
  if (!Platform.isAndroid) return false;
  final major = _osMajorVersion();
  // Material 3 dialogs on Android 12+; AlertDialog still works on older APIs.
  return major == null || major >= 12;
}

/// Native confirm dialog — Cupertino on iOS/macOS, Material on Android.
/// Picks a style that matches the device OS version; destructive action is red only.
Future<bool> showPlatformConfirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String cancelLabel = 'Cancel',
  String confirmLabel = 'Confirm',
  bool isDestructive = false,
}) async {
  final result = await showAdaptiveDialog<bool>(
    context: context,
    barrierDismissible: true,
    builder: (dialogContext) {
      if (_isApplePlatform(dialogContext)) {
        return _buildAppleConfirmDialog(
          dialogContext,
          title: title,
          message: message,
          cancelLabel: cancelLabel,
          confirmLabel: confirmLabel,
          isDestructive: isDestructive,
          modern: _useModernAppleDialog(),
        );
      }
      return _buildAndroidConfirmDialog(
        dialogContext,
        title: title,
        message: message,
        cancelLabel: cancelLabel,
        confirmLabel: confirmLabel,
        isDestructive: isDestructive,
        modern: _useModernAndroidDialog(),
      );
    },
  );
  return result ?? false;
}

Widget _buildAppleConfirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  required String cancelLabel,
  required String confirmLabel,
  required bool isDestructive,
  required bool modern,
}) {
  final brightness = MediaQuery.platformBrightnessOf(context);

  if (!modern) {
    return AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: _dialogActions(
        context,
        cancelLabel: cancelLabel,
        confirmLabel: confirmLabel,
        isDestructive: isDestructive,
      ),
    );
  }

  return CupertinoTheme(
    data: CupertinoThemeData(
      brightness: brightness,
      primaryColor: CupertinoColors.activeBlue.resolveFrom(context),
    ),
    child: CupertinoAlertDialog(
      title: Text(title),
      content: Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Text(message),
      ),
      actions: [
        CupertinoDialogAction(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(cancelLabel),
        ),
        CupertinoDialogAction(
          isDestructiveAction: isDestructive,
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
}

Widget _buildAndroidConfirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  required String cancelLabel,
  required String confirmLabel,
  required bool isDestructive,
  required bool modern,
}) {
  return AlertDialog(
    title: Text(title),
    content: Text(message),
    actionsPadding: modern
        ? const EdgeInsets.fromLTRB(24, 0, 24, 16)
        : const EdgeInsets.only(right: 8, bottom: 8),
    actions: _dialogActions(
      context,
      cancelLabel: cancelLabel,
      confirmLabel: confirmLabel,
      isDestructive: isDestructive,
      modern: modern,
    ),
  );
}

List<Widget> _dialogActions(
  BuildContext context, {
  required String cancelLabel,
  required String confirmLabel,
  required bool isDestructive,
  bool modern = true,
}) {
  final errorColor = Theme.of(context).colorScheme.error;

  return [
    TextButton(
      onPressed: () => Navigator.of(context).pop(false),
      child: Text(cancelLabel),
    ),
    if (isDestructive)
      TextButton(
        onPressed: () => Navigator.of(context).pop(true),
        style: TextButton.styleFrom(foregroundColor: errorColor),
        child: Text(confirmLabel),
      )
    else if (modern)
      FilledButton(
        onPressed: () => Navigator.of(context).pop(true),
        child: Text(confirmLabel),
      )
    else
      TextButton(
        onPressed: () => Navigator.of(context).pop(true),
        child: Text(confirmLabel),
      ),
  ];
}

/// Short feedback — light banner readable on navy and white screens.
void showPlatformMessage(BuildContext context, String message) {
  final trimmed = message.trim();
  if (trimmed.isEmpty) return;

  final overlay = Overlay.of(context);
  late OverlayEntry entry;
  entry = OverlayEntry(
    builder: (context) {
      final top = MediaQuery.paddingOf(context).top;
      return Positioned(
        top: top + 10,
        left: 16,
        right: 16,
        child: Material(
          color: Colors.transparent,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: DriverColors.orange, width: 2),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x40000000),
                  blurRadius: 14,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
              child: Text(
                trimmed,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: DriverColors.navyPanel,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  height: 1.35,
                ),
              ),
            ),
          ),
        ),
      );
    },
  );

  overlay.insert(entry);
  Future<void>.delayed(const Duration(seconds: 3), () {
    if (entry.mounted) entry.remove();
  });
}
