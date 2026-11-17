import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:google_api_availability/google_api_availability.dart';

/// True on iOS and on Android when Google Play Services are present.
/// Huawei devices without GMS return false so those phones use server SMS.
Future<bool> googlePlayServicesAvailable() async {
  if (kIsWeb || !Platform.isAndroid) return true;
  try {
    final status = await GoogleApiAvailability.instance
        .checkGooglePlayServicesAvailability();
    return status == GooglePlayServicesAvailability.success;
  } catch (_) {
    return false;
  }
}
