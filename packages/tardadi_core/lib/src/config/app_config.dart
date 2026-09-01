import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

import 'firebase_project.dart';

class AppConfig {
  const AppConfig({
    required this.apiBaseUrl,
    this.organizationId = defaultOrganizationId,
    this.authToken,
  });

  static const defaultOrganizationId = String.fromEnvironment(
    'TRDDK_ORG_ID',
    defaultValue: 'demo-org',
  );

  /// Production Cloud Functions API (trddk-54c45).
  factory AppConfig.production() {
    return AppConfig(
      apiBaseUrl:
          'https://${TrddkFirebaseProject.functionsRegion}-${TrddkFirebaseProject.projectId}.cloudfunctions.net/api',
      organizationId: defaultOrganizationId,
    );
  }

  /// Local Firebase emulator — opt in with `--dart-define=USE_EMULATOR=true`.
  factory AppConfig.emulator() {
    final host = Platform.isAndroid ? '10.0.2.2' : '127.0.0.1';
    return AppConfig(
      apiBaseUrl: TrddkFirebaseProject.emulatorApiBaseUrl(host: host),
      organizationId: defaultOrganizationId,
    );
  }

  /// Emulator when USE_EMULATOR=true, otherwise production.
  factory AppConfig.current() {
    const useEmulator = bool.fromEnvironment('USE_EMULATOR');
    if (useEmulator && !kReleaseMode) {
      return AppConfig.emulator();
    }
    return AppConfig.production();
  }

  @Deprecated('Use AppConfig.current() or AppConfig.emulator()')
  factory AppConfig.dev() => AppConfig.emulator();

  final String apiBaseUrl;
  final String organizationId;
  final String? authToken;
}

AppConfig resolveTrddkApiConfig() => AppConfig.current();

String resolveTrddkApiBaseUrl() => AppConfig.current().apiBaseUrl;
