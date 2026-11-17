import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../services/driver_navigation.dart';
import '../ui/driver_design.dart';
import '../ui/trddk_typography.dart';

class NavigationBanner extends StatelessWidget {
  const NavigationBanner({
    super.key,
    required this.cue,
    required this.muted,
    required this.showVoiceNotice,
    required this.onMuteToggle,
    required this.onDismissVoiceNotice,
  });

  final NavManeuverCue cue;
  final bool muted;
  final bool showVoiceNotice;
  final VoidCallback onMuteToggle;
  final VoidCallback onDismissVoiceNotice;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final instruction =
        cue.instruction.isEmpty ? l10n.navContinue : cue.instruction;
    final thenText = cue.thenInstruction;

    return Material(
      color: DriverColors.navyPanel,
      elevation: 6,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(0, 0, 4, 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 5,
                  height: 64,
                  color: DriverColors.orange,
                ),
                const SizedBox(width: 12),
                Icon(
                  maneuverIcon(cue.maneuver),
                  color: DriverColors.orange,
                  size: 36,
                  textDirection: TextDirection.ltr,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        instruction,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TrddkTypography.text(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          height: 1.25,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        l10n.formatDistanceKm(cue.distanceMeters / 1000),
                        style: TrddkTypography.text(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: DriverColors.orange,
                        ),
                      ),
                      if (thenText != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          l10n.navThen(thenText),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TrddkTypography.text(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Colors.white.withValues(alpha: 0.72),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                IconButton(
                  onPressed: onMuteToggle,
                  tooltip: muted ? l10n.navUnmute : l10n.navMute,
                  icon: Icon(
                    muted
                        ? Icons.volume_off_rounded
                        : Icons.volume_up_rounded,
                    color: muted ? DriverColors.muted : DriverColors.orange,
                  ),
                ),
              ],
            ),
            if (showVoiceNotice)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 2, 8, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        l10n.navVoiceUnavailable,
                        style: TrddkTypography.text(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: DriverColors.orange,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: onDismissVoiceNotice,
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(
                        Icons.close_rounded,
                        color: Colors.white70,
                        size: 18,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

IconData maneuverIcon(String maneuver) {
  return switch (maneuver) {
    'TURN_LEFT' || 'TURN_SLIGHT_LEFT' || 'TURN_SHARP_LEFT' => Icons.turn_left,
    'TURN_RIGHT' ||
    'TURN_SLIGHT_RIGHT' ||
    'TURN_SHARP_RIGHT' =>
      Icons.turn_right,
    'UTURN_LEFT' => Icons.u_turn_left,
    'UTURN_RIGHT' => Icons.u_turn_right,
    'ROUNDABOUT_LEFT' => Icons.roundabout_left,
    'ROUNDABOUT_RIGHT' => Icons.roundabout_right,
    'FORK_LEFT' => Icons.fork_left,
    'FORK_RIGHT' => Icons.fork_right,
    'RAMP_LEFT' || 'ON_RAMP_LEFT' || 'OFF_RAMP_LEFT' => Icons.ramp_left,
    'RAMP_RIGHT' || 'ON_RAMP_RIGHT' || 'OFF_RAMP_RIGHT' => Icons.ramp_right,
    'MERGE' => Icons.merge,
    _ => Icons.straight,
  };
}
