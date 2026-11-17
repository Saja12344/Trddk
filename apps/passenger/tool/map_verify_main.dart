import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:tardadi_core/tardadi_core.dart';
import 'package:tardadi_passenger/l10n/app_localizations.dart';
import 'package:tardadi_passenger/models/route_list_item.dart';
import 'package:tardadi_passenger/screens/route_map_screen.dart';
import 'package:tardadi_passenger/services/user_session.dart';
import 'package:tardadi_passenger/ui/trddk_typography.dart';

/// Verification entry: `flutter run -t tool/map_verify_main.dart`
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const _PassengerMapVerifyApp());
}

class _PassengerMapVerifyApp extends StatelessWidget {
  const _PassengerMapVerifyApp();

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations(AppLanguage.arabic);

    return MaterialApp(
      title: 'Passenger Map Verify',
      debugShowCheckedModeBanner: false,
      theme: TardadiBrand.darkTheme().copyWith(
        textTheme: TrddkTypography.ubuntuTextTheme(
          TardadiBrand.darkTheme().textTheme,
        ),
      ),
      locale: localizations.locale,
      supportedLocales: const [Locale('en'), Locale('ar')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) {
        return AppLocaleScope(
          localizations: localizations,
          child: Directionality(
            textDirection: localizations.textDirection,
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
      home: RouteMapScreen(
        route: RouteListItem(
          routeId: '4vl85nqCdTsaY7BxCZif',
          name: 'SABIC',
          nameAr: 'سابك',
          frequencyLabel: 'Live',
          busCountLabel: '1 live / 1',
          stationsCountLabel: '0 Stations',
          isBusiness: true,
          businessId: 'wqDhbyrVZsSSrzeEw9Ac',
          liveBusCount: 1,
          activeBusCount: 1,
        ),
      ),
    );
  }
}
