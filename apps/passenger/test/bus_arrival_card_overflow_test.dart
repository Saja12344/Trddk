import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tardadi_passenger/l10n/app_localizations.dart';
import 'package:tardadi_passenger/models/route_list_item.dart';
import 'package:tardadi_passenger/screens/route_map_screen.dart';
import 'package:tardadi_passenger/services/user_session.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final cases = <(AppLanguage, String, String)>[
    (AppLanguage.english, 'Bus 12', 'medium'),
    (AppLanguage.english, 'Bus 12 — King Faisal Specialist shuttle', 'medium'),
    (AppLanguage.arabic, 'Bus 12', 'medium'),
    (AppLanguage.arabic, 'باص ١٢ — مستشفى الملك فيصل التخصصي', 'high'),
  ];

  for (final (language, name, crowding) in cases) {
    testWidgets('arrival card fits 360px ${language.name} "$name"', (tester) async {
      await tester.binding.setSurfaceSize(const Size(360, 800));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final l10n = AppLocalizations(language);
      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => AppLocaleScope(
            localizations: l10n,
            child: Directionality(
              textDirection: l10n.textDirection,
              child: child!,
            ),
          ),
          home: Scaffold(
            body: Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 28),
              child: Column(
                children: [
                  previewBusArrivalCard(
                    notificationsEnabled: true,
                    item: BusArrivalItem(
                      id: 'bus-12',
                      name: name,
                      vehicleType: VehicleType.bus,
                      minutesAway: 12,
                      crowdingLabel: crowding,
                      isLive: true,
                    ),
                  ),
                  previewBusArrivalCard(
                    item: BusArrivalItem(
                      id: 'bus-now',
                      name: name,
                      vehicleType: VehicleType.bus,
                      minutesAway: 0,
                      crowdingLabel: 'low',
                      isLive: false,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      expect(tester.takeException(), isNull);
      expect(find.text(l10n.etaUnit), findsOneWidget);
      expect(find.text(l10n.etaNow), findsOneWidget);
    });
  }

  testWidgets('live badge ticker stops when TickerMode is off', (tester) async {
    final l10n = AppLocalizations(AppLanguage.english);
    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => AppLocaleScope(
          localizations: l10n,
          child: TickerMode(enabled: false, child: child!),
        ),
        home: Scaffold(
          body: previewBusArrivalCard(
            item: const BusArrivalItem(
              id: 'bus-12',
              name: 'Bus 12',
              vehicleType: VehicleType.bus,
              minutesAway: 4,
              crowdingLabel: 'high',
              isLive: true,
            ),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 50));
    expect(tester.binding.transientCallbackCount, 0);
    expect(tester.takeException(), isNull);
  });
}
