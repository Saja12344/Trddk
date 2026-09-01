import 'package:tardadi_core/tardadi_core.dart';

TardadiApi createDriverApi({String? organizationId}) {
  final base = resolveTrddkApiConfig();
  if (organizationId != null && organizationId.isNotEmpty) {
    return TardadiApi(
      config: AppConfig(
        apiBaseUrl: base.apiBaseUrl,
        organizationId: organizationId,
      ),
    );
  }
  return TardadiApi(config: base);
}

String driverApiBaseUrl() => resolveTrddkApiBaseUrl();
