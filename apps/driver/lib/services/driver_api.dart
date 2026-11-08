import 'package:tardadi_core/tardadi_core.dart';

TardadiApi createDriverApi({String? organizationId, String? authToken}) {
  final base = resolveTrddkApiConfig();
  final org = organizationId != null && organizationId.isNotEmpty
      ? organizationId
      : base.organizationId;
  final token = authToken != null && authToken.isNotEmpty
      ? authToken
      : base.authToken;
  return TardadiApi(
    config: AppConfig(
      apiBaseUrl: base.apiBaseUrl,
      organizationId: org,
      authToken: token,
    ),
  );
}

String driverApiBaseUrl() => resolveTrddkApiBaseUrl();
