import 'package:flutter/material.dart';
import 'package:tardadi_core/tardadi_core.dart';

import '../l10n/app_localizations.dart';
import '../services/driver_api.dart';
import '../services/driver_prefs.dart';
import '../services/locale_notifier.dart';
import '../services/session_store.dart';
import '../ui/driver_design.dart';
import '../ui/platform_ui.dart';
import '../utils/arabic_display.dart';
import 'map_screen.dart';

const kVehicleOptions = ['Bus', 'Golf car', 'Van', 'Private car'];

const _vehicleAssets = <String, String>{
  'Bus': DriverAssets.vehicleBus,
  'Golf car': DriverAssets.vehicleGolf,
  'Van': DriverAssets.vehicleVan,
  'Private car': DriverAssets.vehicleCar,
};

String _displayDriverName(BuildContext context, DriverSession session) {
  final name = session.driver.name.trim();
  if (name.isEmpty) {
    return context.displayPersonName('Ahmed Al-Rashid');
  }
  return context.displayPersonName(
    name,
    nameAr: session.driver.nameAr,
    nameEn: session.driver.nameEn,
  );
}

String _driverInitials(String name) {
  final parts = name
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) return 'AK';
  if (parts.length == 1) {
    final first = parts.first;
    return first.substring(0, first.length >= 2 ? 2 : 1).toUpperCase();
  }
  return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
}

String _routeSummary(BuildContext context, DriverSession session) {
  final bus = context.displayPlaceName(
    session.bus.label.trim(),
    nameAr: session.bus.labelAr,
    nameEn: session.bus.labelEn,
  );
  final route = context.displayPlaceName(
    session.route.name.trim(),
    nameAr: session.route.nameAr,
    nameEn: session.route.nameEn,
  );
  final pieces = [if (bus.isNotEmpty) bus, if (route.isNotEmpty) route];
  return pieces.isEmpty ? 'Track · Yellow' : pieces.join(' · ');
}

/// First login only — grid picker (Chose.png).
class VehicleOnboardingScreen extends StatefulWidget {
  const VehicleOnboardingScreen({super.key});

  @override
  State<VehicleOnboardingScreen> createState() => _VehicleOnboardingScreenState();
}

class _VehicleOnboardingScreenState extends State<VehicleOnboardingScreen> {
  String? _selected;

  Future<void> _continue() async {
    final selected = _selected;
    if (selected == null) return;

    final session = SessionStore.instance.session;
    if (session == null) return;

    final driverKey = DriverPrefs.driverKey(
      phone: session.driver.phone,
      driverId: session.driver.driverId,
    );
    await DriverPrefs.instance.saveVehicleSetup(
      driverKey: driverKey,
      vehicle: selected,
    );
    SessionStore.instance.setVehicle(selected);

    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      driverRoute(builder: (_) => const MapScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final top = MediaQuery.paddingOf(context).top;
    final bottom = MediaQuery.paddingOf(context).bottom;
    final canContinue = _selected != null;

    return DriverChrome(
      child: Padding(
        padding: EdgeInsets.fromLTRB(32, top + 40, 32, bottom + 20),
        child: Column(
          children: [
            Image.asset(DriverAssets.mark, width: 80, fit: BoxFit.contain),
            const SizedBox(height: 32),
            Text(
              l10n.chooseVehicle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              l10n.chooseVehicleHint,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: DriverColors.muted,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 32),
            Expanded(
              child: GridView.count(
                crossAxisCount: 2,
                mainAxisSpacing: 16,
                crossAxisSpacing: 16,
                childAspectRatio: 1.02,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  for (final vehicle in kVehicleOptions)
                    _VehicleGridCard(
                      vehicle: vehicle,
                      label: context.l10n.vehicleLabel(vehicle),
                      selected: _selected == vehicle,
                      onTap: () => setState(() => _selected = vehicle),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            DriverButton(
              label: l10n.next,
              onPressed: canContinue ? _continue : null,
              color: DriverColors.orange,
              height: 56,
              fontSize: 24,
            ),
          ],
        ),
      ),
    );
  }
}

class _VehicleGridCard extends StatelessWidget {
  const _VehicleGridCard({
    required this.vehicle,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  /// Vehicle key ('Bus', 'Van'...) used to find the image.
  final String vehicle;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        color: selected
            ? Color.alphaBlend(
                DriverColors.orange.withValues(alpha: 0.12),
                const Color(0xFF1A1D5C),
              )
            : const Color(0xFF1A1D5C),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: selected
              ? DriverColors.orange
              : Colors.white.withValues(alpha: 0.06),
          width: selected ? 2 : 1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(18),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Stack(
            children: [
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 18),
                child: Column(
                  children: [
                    Expanded(
                      child: Center(
                        // Use the key, not the translated label, or the
                        // Arabic UI finds no image.
                        child: _VehicleAssetIcon(
                          vehicle: vehicle,
                          iconBoxWidth: 96,
                          iconBoxHeight: 50,
                          color: selected
                              ? DriverColors.orange
                              : Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      label,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: selected
                            ? Colors.white
                            : Colors.white.withValues(alpha: 0.8),
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              if (selected)
                PositionedDirectional(
                  top: 10,
                  end: 10,
                  child: Container(
                    width: 22,
                    height: 22,
                    decoration: const BoxDecoration(
                      color: DriverColors.orange,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.check_rounded,
                      size: 15,
                      color: Colors.white,
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

class _VehicleAssetIcon extends StatelessWidget {
  const _VehicleAssetIcon({
    required this.vehicle,
    this.iconBoxHeight = 54,
    this.iconBoxWidth = 84,
    this.color = DriverColors.orange,
  });

  final String vehicle;
  final double iconBoxHeight;
  final double iconBoxWidth;

  /// Vehicle artwork is white line-art; tinted here (orange by default).
  final Color color;

  @override
  Widget build(BuildContext context) {
    final asset = _vehicleAssets[vehicle];
    if (asset == null) return const SizedBox.shrink();
    return SizedBox(
      width: iconBoxWidth,
      height: iconBoxHeight,
      child: Center(
        child: Image.asset(
          asset,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.high,
          gaplessPlayback: true,
          width: iconBoxWidth,
          height: iconBoxHeight,
          color: color,
          colorBlendMode: BlendMode.srcIn,
        ),
      ),
    );
  }
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    required this.session,
    required this.selectedVehicle,
    required this.onVehicleChanged,
    required this.onLogout,
    required this.tripActive,
  });

  final DriverSession session;
  final String selectedVehicle;
  final ValueChanged<String> onVehicleChanged;
  final VoidCallback onLogout;
  final bool tripActive;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late String _vehicle = widget.selectedVehicle;
  bool _notifications = true;
  bool _deleting = false;
  late bool _english = !LocaleNotifier.instance.isArabic;

  @override
  void initState() {
    super.initState();
    DriverPrefs.instance.notificationsEnabled().then((value) {
      if (mounted) setState(() => _notifications = value);
    });
  }

  Future<void> _setNotifications(bool value) async {
    setState(() => _notifications = value);
    await DriverPrefs.instance.setNotificationsEnabled(value);
  }

  Future<void> _setLanguage(bool english) async {
    if (english == _english) return;
    setState(() => _english = english);
    await LocaleNotifier.instance
        .setLocale(english ? const Locale('en') : const Locale('ar'));
    if (!mounted) return;
    DriverSnack.show(context, context.l10n.languageSaved);
  }

  Future<void> _deleteAccount() async {
    final l10n = context.l10n;
    if (widget.tripActive) {
      await showPlatformConfirmDialog(
        context,
        title: l10n.endTripBeforeDeleteTitle,
        message: l10n.endTripBeforeDeleteBody,
        cancelLabel: l10n.cancel,
        confirmLabel: l10n.ok,
      );
      return;
    }

    final confirmed = await showPlatformConfirmDialog(
      context,
      title: l10n.deleteAccountTitle,
      message: l10n.deleteAccountBody,
      cancelLabel: l10n.cancel,
      confirmLabel: l10n.delete,
      isDestructive: true,
    );
    if (!confirmed || !mounted) return;

    setState(() => _deleting = true);
    while (mounted) {
      try {
        final session = widget.session;
        await createDriverApi(
          organizationId: session.driver.businessId,
          authToken: session.sessionToken,
        ).deleteDriverAccount();
        if (!mounted) return;
        final driverKey = DriverPrefs.driverKey(
          phone: session.driver.phone,
          driverId: session.driver.driverId,
        );
        await DriverPrefs.instance.clearAccountData(driverKey: driverKey);
        SessionStore.instance.clear();
        if (!mounted) return;
        final navigator = Navigator.of(context);
        navigator.pushNamedAndRemoveUntil('/login', (_) => false);
        ScaffoldMessenger.of(navigator.context).showSnackBar(
          SnackBar(content: Text(l10n.deleteAccountDone)),
        );
        return;
      } catch (error) {
        if (!mounted) return;
        setState(() => _deleting = false);
        final retry = await showPlatformConfirmDialog(
          context,
          title: l10n.deleteAccountFailed,
          message: '$error',
          cancelLabel: l10n.cancel,
          confirmLabel: l10n.retry,
        );
        if (!retry || !mounted) return;
        setState(() => _deleting = true);
      }
    }
  }

  Future<void> _changeVehicle() async {
    final next = await Navigator.of(context).push<String>(
      driverRoute(
        builder: (_) => ChangeVehicleScreen(selectedVehicle: _vehicle),
      ),
    );
    if (next == null) return;
    setState(() => _vehicle = next);
    widget.onVehicleChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final displayName = _displayDriverName(context, widget.session);
    final routeSummary = _routeSummary(context, widget.session);

    return Stack(
      children: [
        DriverSidePanel(
      onClose: () => Navigator.pop(context),
      child: LayoutBuilder(
        builder: (context, constraints) {
          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 36, 24, 24),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: constraints.maxHeight - 60,
              ),
              child: IntrinsicHeight(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _DriverProfileHeader(
                      name: displayName,
                      subtitle: routeSummary,
                    ),
                    const SizedBox(height: 28),
                    _SectionLabel(l10n.vehicle),
                    const SizedBox(height: 10),
                    _SettingsCard(
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: _changeVehicle,
                          borderRadius: BorderRadius.circular(16),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              children: [
                                Container(
                                  width: 84,
                                  height: 58,
                                  decoration: BoxDecoration(
                                    color: DriverColors.navy,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  alignment: Alignment.center,
                                  child: _VehicleAssetIcon(
                                    vehicle: _vehicle,
                                    iconBoxWidth: 62,
                                    iconBoxHeight: 34,
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        l10n.vehicleLabel(_vehicle),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        l10n.currentAssignedVehicle,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: DriverColors.muted,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  l10n.change,
                                  style: const TextStyle(
                                    color: DriverColors.orange,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(width: 4),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 22),
                    _SectionLabel(l10n.preferences),
                    const SizedBox(height: 10),
                    _SettingsCard(
                      child: Column(
                        children: [
                          _SettingRow(
                            icon: Icons.language_rounded,
                            label: l10n.language,
                            trailing: _SegmentToggle(
                              left: 'English',
                              right: 'العربية',
                              leftSelected: _english,
                              onChanged: _setLanguage,
                            ),
                          ),
                          const _CardDivider(),
                          _SettingRow(
                            icon: Icons.notifications_none_rounded,
                            label: l10n.notifications,
                            trailing: _SwitchPill(
                              value: _notifications,
                              onChanged: _setNotifications,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    const SizedBox(height: 24),
                    Divider(
                      height: 1,
                      color: Colors.white.withValues(alpha: 0.08),
                    ),
                    TextButton.icon(
                      onPressed: widget.onLogout,
                      style: TextButton.styleFrom(
                        foregroundColor: DriverColors.orange,
                        minimumSize: const Size.fromHeight(52),
                        textStyle: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      icon: const Icon(Icons.logout_rounded, size: 18),
                      label: Text(l10n.logOut),
                    ),
                    TextButton.icon(
                      onPressed: _deleting ? null : _deleteAccount,
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFFFF6B6B),
                        minimumSize: const Size.fromHeight(40),
                        textStyle: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      icon: const Icon(Icons.delete_outline_rounded, size: 16),
                      label: Text(l10n.deleteAccount),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
        ),
        if (_deleting) ...[
          const ModalBarrier(dismissible: false, color: Color(0x88000000)),
          const Center(
            child: CircularProgressIndicator(color: DriverColors.orange),
          ),
        ],
      ],
    );
  }
}

class ChangeVehicleScreen extends StatefulWidget {
  const ChangeVehicleScreen({super.key, required this.selectedVehicle});

  final String selectedVehicle;

  @override
  State<ChangeVehicleScreen> createState() => _ChangeVehicleScreenState();
}

class _ChangeVehicleScreenState extends State<ChangeVehicleScreen> {
  late String _selected = widget.selectedVehicle;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return DriverSidePanel(
      onClose: () => Navigator.pop(context),
      child: LayoutBuilder(
        builder: (context, constraints) {
          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 34, 24, 24),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: constraints.maxHeight - 58,
              ),
              child: IntrinsicHeight(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        _HeaderIconButton(
                          icon: Icons.chevron_left_rounded,
                          onTap: () => Navigator.pop(context),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                l10n.changeVehicle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 24,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                l10n.selectAssignedVehicle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Color(0x8CFFFFFF),
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 28),
                    _SettingsCard(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            _VehicleAssetIcon(
                              vehicle: _selected,
                              iconBoxWidth: 48,
                              iconBoxHeight: 28,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    l10n.vehicleLabel(_selected),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 17,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    l10n.currentAssignedVehicle,
                                    style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.45),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    _SectionLabel(l10n.availableVehicles),
                    const SizedBox(height: 10),
                    _SettingsCard(
                      child: Column(
                        children: [
                          for (int index = 0; index < kVehicleOptions.length; index++) ...[
                            _VehicleOption(
                              vehicle: kVehicleOptions[index],
                              label: l10n.vehicleLabel(kVehicleOptions[index]),
                              selected: _selected == kVehicleOptions[index],
                              onTap: () =>
                                  setState(() => _selected = kVehicleOptions[index]),
                            ),
                            if (index != kVehicleOptions.length - 1)
                              const _CardDivider(),
                          ],
                        ],
                      ),
                    ),
                    const Spacer(),
                    const SizedBox(height: 28),
                    DriverButton(
                      label: l10n.saveChanges,
                      color: DriverColors.orange,
                      onPressed: () => Navigator.pop(context, _selected),
                      height: 54,
                      fontSize: 18,
                    ),
                  ],
                ),
              ),
            ),
          );
        },
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
      style: const TextStyle(
        color: DriverColors.muted,
        fontSize: 13,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}

class _DriverProfileHeader extends StatelessWidget {
  const _DriverProfileHeader({
    required this.name,
    required this.subtitle,
  });

  final String name;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: const BoxDecoration(
            color: DriverColors.orange,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            _driverInitials(name),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(
                    Icons.directions_bus_outlined,
                    size: 15,
                    color: Color(0x8CFFFFFF),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.55),
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1F2263),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: child,
    );
  }
}

class _CardDivider extends StatelessWidget {
  const _CardDivider();

  @override
  Widget build(BuildContext context) {
    return Divider(
      height: 1,
      thickness: 0.5,
      indent: 16,
      endIndent: 16,
      color: Colors.white.withValues(alpha: 0.1),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({
    required this.icon,
    required this.onTap,
  });

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.06),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(icon, color: Colors.white, size: 28),
        ),
      ),
    );
  }
}

class _VehicleOption extends StatelessWidget {
  const _VehicleOption({
    required this.vehicle,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  /// Vehicle key ('Bus', 'Van'...) — the label is translated.
  final String vehicle;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected
          ? DriverColors.orange.withValues(alpha: 0.10)
          : Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              _VehicleAssetIcon(
                vehicle: vehicle,
                iconBoxWidth: 52,
                iconBoxHeight: 28,
                color: selected ? DriverColors.orange : Colors.white,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: selected ? DriverColors.orange : Colors.white54,
                    width: 1.4,
                  ),
                  color: selected ? DriverColors.orange : Colors.transparent,
                ),
                alignment: Alignment.center,
                child: selected
                    ? const Icon(
                        Icons.check_rounded,
                        size: 14,
                        color: Colors.white,
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

class _SettingRow extends StatelessWidget {
  const _SettingRow({
    required this.icon,
    required this.label,
    required this.trailing,
  });

  final IconData icon;
  final String label;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Icon(
            icon,
            size: 18,
            color: const Color(0x99FFFFFF),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 8),
          trailing,
        ],
      ),
    );
  }
}

class _SegmentToggle extends StatelessWidget {
  const _SegmentToggle({
    required this.left,
    required this.right,
    required this.leftSelected,
    required this.onChanged,
  });

  final String left;
  final String right;
  final bool leftSelected;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 124,
      height: 34,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        children: [
          _TogglePart(
            label: left,
            selected: leftSelected,
            onTap: () => onChanged(true),
          ),
          _TogglePart(
            label: right,
            selected: !leftSelected,
            onTap: () => onChanged(false),
          ),
        ],
      ),
    );
  }
}

class _TogglePart extends StatelessWidget {
  const _TogglePart({
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
        child: Container(
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? DriverColors.orange : Colors.transparent,
            borderRadius: BorderRadius.circular(999),
          ),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              label,
              maxLines: 1,
              style: TextStyle(
                color: selected ? Colors.white : Colors.white54,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SwitchPill extends StatelessWidget {
  const _SwitchPill({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 44,
        height: 26,
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: value
              ? DriverColors.orange
              : Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Align(
          alignment: value
              ? AlignmentDirectional.centerEnd
              : AlignmentDirectional.centerStart,
          child: Container(
            width: 20,
            height: 20,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(999),
            ),
          ),
        ),
      ),
    );
  }
}
