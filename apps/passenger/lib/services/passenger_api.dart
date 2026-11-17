import 'package:tardadi_core/tardadi_core.dart';

import 'user_session.dart';

TardadiApi createPassengerApi({String? organizationId, String? authToken}) {
  final base = resolveTrddkApiConfig();
  final session = UserSession.instance;
  final resolvedOrg = organizationId ??
      (session.hasBusinessSession ? session.businessId : null);
  final resolvedToken = authToken ?? session.sessionToken;

  return TardadiApi(
    config: AppConfig(
      apiBaseUrl: base.apiBaseUrl,
      organizationId: resolvedOrg?.isNotEmpty == true
          ? resolvedOrg!
          : base.organizationId,
      authToken: resolvedToken,
    ),
  );
}

String passengerApiBaseUrl() => resolveTrddkApiBaseUrl();
