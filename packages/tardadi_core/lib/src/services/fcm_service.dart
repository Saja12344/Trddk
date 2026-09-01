import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:permission_handler/permission_handler.dart';

/// Shared FCM token helper — call after [Firebase.initializeApp].
class TrddkFcmService {
  TrddkFcmService._();

  static final TrddkFcmService instance = TrddkFcmService._();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  String? _cachedToken;

  Future<void> initialize() async {
    await _requestPlatformPermissions();
    _cachedToken = await _messaging.getToken();
    _messaging.onTokenRefresh.listen((token) {
      _cachedToken = token;
    });
  }

  Future<void> _requestPlatformPermissions() async {
    if (Platform.isIOS) {
      await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      await _messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );
      return;
    }

    if (Platform.isAndroid) {
      final status = await Permission.notification.status;
      if (!status.isGranted) {
        await Permission.notification.request();
      }
    }
  }

  Future<String?> getToken() async {
    if (_cachedToken != null && _cachedToken!.isNotEmpty) {
      return _cachedToken;
    }
    _cachedToken = await _messaging.getToken();
    return _cachedToken;
  }
}
