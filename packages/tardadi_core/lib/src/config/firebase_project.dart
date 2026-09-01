/// Firebase / Cloud Functions project identifier for Trddk.
abstract final class TrddkFirebaseProject {
  static const String projectId = String.fromEnvironment(
    'FIREBASE_PROJECT_ID',
    defaultValue: 'trddk-54c45',
  );

  static const String functionsRegion = String.fromEnvironment(
    'FIREBASE_FUNCTIONS_REGION',
    defaultValue: 'us-central1',
  );

  static String emulatorApiBaseUrl({required String host}) {
    return 'http://$host:5001/$projectId/$functionsRegion/api';
  }
}
