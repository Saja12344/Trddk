import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../models/models.dart';
import 'passenger_auth_models.dart';

class TardadiApi {
  TardadiApi({AppConfig? config}) : _config = config ?? AppConfig.current();

  final AppConfig _config;

  Uri _uri(String path, [Map<String, String>? extraQuery]) {
    final publicScope = extraQuery?['scope'] == 'public';
    final orgOverride = extraQuery?['organizationId'];
    final query = {
      if (!publicScope && orgOverride == null)
        'organizationId': _config.organizationId,
      ...?extraQuery,
    };
    return Uri.parse('${_config.apiBaseUrl}$path')
        .replace(queryParameters: query);
  }

  Future<T> _request<T>(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    Map<String, String>? query,
    String? baseUrl,
    Duration timeout = const Duration(seconds: 15),
    required T Function(dynamic data) parser,
  }) async {
    final uri = baseUrl == null
        ? _uri(path, query)
        : Uri.parse('$baseUrl$path');
    final headers = <String, String>{
      if (method == 'POST') 'Content-Type': 'application/json',
      if (_config.authToken != null && _config.authToken!.isNotEmpty)
        'Authorization': 'Bearer ${_config.authToken}',
    };
    final response = await switch (method) {
      'GET' => http.get(uri, headers: headers.isEmpty ? null : headers),
      'POST' => http.post(
          uri,
          headers: headers,
          body: body == null ? null : jsonEncode(body),
        ),
      'DELETE' => http.delete(uri, headers: headers.isEmpty ? null : headers),
      _ => throw UnsupportedError('Unsupported method: $method'),
    }.timeout(timeout);

    Map<String, dynamic> decoded;
    try {
      decoded = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw Exception(
        response.statusCode >= 400
            ? 'Request failed (${response.statusCode})'
            : 'Invalid server response',
      );
    }
    if (decoded['success'] != true) {
      throw Exception(decoded['error'] ?? 'Request failed');
    }

    return parser(decoded['data']);
  }

  Future<List<RouteModel>> getRoutes({bool publicScope = false}) {
    return _request(
      '/api/routes',
      query: publicScope ? {'scope': 'public'} : null,
      parser: (data) => (data as List)
          .map((e) => RouteModel.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  Future<({RouteModel route, List<StopModel> stops})> getRoute(
    String routeId,
  ) {
    return _request(
      '/api/routes/$routeId',
      parser: (data) {
        final map = data as Map<String, dynamic>;
        return (
          route: RouteModel.fromJson(map['route'] as Map<String, dynamic>),
          stops: (map['stops'] as List)
              .map((e) => StopModel.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      },
    );
  }

  Future<List<BusModel>> getBuses({bool activeOnly = false}) {
    return _request(
      '/api/buses',
      query: activeOnly ? {'active': 'true'} : null,
      parser: (data) => (data as List)
          .map((e) => BusModel.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  Future<void> driverStartLogin({
    required String phone,
  }) {
    return _request(
      '/api/auth/driver-start-login',
      method: 'POST',
      body: {
        'organizationId': _config.organizationId,
        'phone': phone,
      },
      parser: (_) {},
    );
  }

  Future<DriverSession> driverReviewLogin({
    required String phone,
    required String code,
  }) {
    return _request(
      '/api/auth/driver-review-login',
      method: 'POST',
      body: {
        'phone': phone,
        'code': code,
      },
      parser: _parseDriverSession,
    );
  }

  Future<DriverSession> driverVerifyOtp({
    required String phone,
    required String code,
  }) {
    return _request(
      '/api/auth/driver-verify-otp',
      method: 'POST',
      body: {
        'organizationId': _config.organizationId,
        'phone': phone,
        'code': code,
      },
      parser: _parseDriverSession,
    );
  }

  Future<DriverSession> driverLogin({
    required String phone,
  }) {
    return _request(
      '/api/auth/driver-login',
      method: 'POST',
      body: {
        'organizationId': _config.organizationId,
        'phone': phone,
      },
      parser: _parseDriverSession,
    );
  }

  Future<DriverSession> driverFirebaseLogin({
    required String idToken,
  }) {
    return _request(
      '/api/auth/firebase-app-session',
      method: 'POST',
      body: {
        'idToken': idToken,
        'app': 'driver',
      },
      parser: _parseDriverSession,
    );
  }

  Future<({bool requiresPassword})> driverLoginHint({
    required String email,
  }) {
    return _request(
      '/api/auth/app-login-hint',
      method: 'POST',
      body: {
        'email': email,
        'app': 'driver',
      },
      parser: (data) {
        final map = data as Map<String, dynamic>;
        return (requiresPassword: map['requiresPassword'] as bool? ?? false);
      },
    );
  }

  Future<void> driverSendPasswordSetup({required String email}) {
    return _request(
      '/api/auth/app-send-password-setup',
      method: 'POST',
      body: {
        'email': email,
        'app': 'driver',
      },
      parser: (_) {},
    );
  }

  Future<void> passengerFirebaseLogin({required String idToken}) {
    return _request(
      '/api/auth/firebase-app-session',
      method: 'POST',
      body: {
        'idToken': idToken,
        'app': 'passenger',
      },
      parser: (_) {},
    );
  }

  Future<({bool requiresPassword})> passengerLoginHint({
    required String email,
  }) {
    return _request(
      '/api/auth/app-login-hint',
      method: 'POST',
      body: {
        'email': email,
        'app': 'passenger',
      },
      parser: (data) {
        final map = data as Map<String, dynamic>;
        return (requiresPassword: map['requiresPassword'] as bool? ?? false);
      },
    );
  }

  Future<void> passengerSendPasswordSetup({required String email}) {
    return _request(
      '/api/auth/app-send-password-setup',
      method: 'POST',
      body: {
        'email': email,
        'app': 'passenger',
      },
      parser: (_) {},
    );
  }

  Future<void> passengerSendEmailOtp({required String email}) {
    return _request(
      '/api/auth/passenger-send-otp',
      method: 'POST',
      body: {'email': email},
      parser: (_) {},
    );
  }

  Future<void> passengerVerifyEmailOtp({
    required String email,
    required String code,
    String purpose = 'personal',
  }) {
    return _request(
      '/api/auth/passenger-verify-otp',
      method: 'POST',
      body: {'email': email, 'code': code, 'purpose': purpose},
      parser: (_) {},
    );
  }

  Future<PassengerOtpVerifyResult> passengerVerifyEmailOtpDetailed({
    required String email,
    required String code,
    String purpose = 'personal',
  }) {
    return _request(
      '/api/auth/passenger-verify-otp',
      method: 'POST',
      body: {'email': email, 'code': code, 'purpose': purpose},
      parser: (data) => PassengerOtpVerifyResult.fromJson(
        data as Map<String, dynamic>,
      ),
    );
  }

  Future<void> passengerStartPhoneLogin({
    required String phone,
  }) {
    return _request(
      '/api/auth/passenger-start-phone-login',
      method: 'POST',
      body: {'phone': phone},
      parser: (_) {},
    );
  }

  Future<PassengerOtpVerifyResult> passengerVerifyPhoneOtp({
    required String phone,
    required String code,
  }) {
    return _request(
      '/api/auth/passenger-verify-phone-otp',
      method: 'POST',
      body: {'phone': phone, 'code': code},
      parser: (data) => PassengerOtpVerifyResult.fromJson(
        data as Map<String, dynamic>,
      ),
    );
  }

  Future<PassengerOtpVerifyResult> passengerPhoneLogin({
    required String idToken,
  }) {
    return _request(
      '/api/auth/passenger-phone-login',
      method: 'POST',
      body: {'idToken': idToken},
      parser: (data) => PassengerOtpVerifyResult.fromJson(
        data as Map<String, dynamic>,
      ),
    );
  }

  Future<PassengerReviewSessionResult> passengerReviewLogin({
    required String phone,
    required String code,
  }) {
    return _request(
      '/api/auth/passenger-review-login',
      method: 'POST',
      body: {'phone': phone, 'code': code},
      parser: (data) => PassengerReviewSessionResult.fromJson(
        data as Map<String, dynamic>,
      ),
    );
  }

  Future<PassengerBusinessSessionResult> passengerBusinessSession({
    required String verificationToken,
    required String businessId,
  }) {
    return _request(
      '/api/auth/passenger-business-session',
      method: 'POST',
      body: {
        'verificationToken': verificationToken,
        'businessId': businessId,
      },
      parser: (data) => PassengerBusinessSessionResult.fromJson(
        data as Map<String, dynamic>,
      ),
    );
  }

  DriverSession _parseDriverSession(dynamic data) {
    final map = data as Map<String, dynamic>;
    return DriverSession(
      driver: DriverModel.fromJson(map['driver'] as Map<String, dynamic>),
      bus: BusModel.fromJson(map['bus'] as Map<String, dynamic>),
      route: RouteModel.fromJson(map['route'] as Map<String, dynamic>),
      stops: (map['stops'] as List)
          .map((e) => StopModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      tripId: map['tripId'] as String?,
      sessionToken: map['sessionToken'] as String?,
    );
  }

  Future<List<TripModel>> getTrips({String? status}) {
    return _request(
      '/api/trips',
      query: status == null ? null : {'status': status},
      parser: (data) => (data as List)
          .map((e) => TripModel.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  Future<String> startTrip({
    required String driverId,
    required String busId,
    required String routeId,
  }) {
    return _request(
      '/api/trips/start',
      method: 'POST',
      body: {
        'organizationId': _config.organizationId,
        'driverId': driverId,
        'busId': busId,
        'routeId': routeId,
      },
      parser: (data) => (data as Map<String, dynamic>)['tripId'] as String,
    );
  }

  Future<void> endTrip({
    required String tripId,
    required String driverId,
  }) {
    return _request(
      '/api/trips/end',
      method: 'POST',
      body: {
        'organizationId': _config.organizationId,
        'tripId': tripId,
        'driverId': driverId,
      },
      parser: (_) {},
    );
  }

  Future<void> markTripArrived({
    required String tripId,
    required String driverId,
    String? stopId,
  }) {
    return _request(
      '/api/trips/arrived',
      method: 'POST',
      body: {
        'organizationId': _config.organizationId,
        'tripId': tripId,
        'driverId': driverId,
        if (stopId != null) 'stopId': stopId,
      },
      parser: (_) {},
    );
  }

  Future<void> setTripBreak({
    required String tripId,
    required String driverId,
    required bool onBreak,
  }) {
    return _request(
      '/api/trips/break',
      method: 'POST',
      body: {
        'organizationId': _config.organizationId,
        'tripId': tripId,
        'driverId': driverId,
        'onBreak': onBreak,
      },
      parser: (_) {},
    );
  }

  Future<void> sendGps({
    required String tripId,
    required String driverId,
    required String busId,
    required double latitude,
    required double longitude,
    double? speedKmh,
    double? heading,
    String? crowdLevel,
    bool? onBreak,
  }) {
    return _request(
      '/api/gps',
      method: 'POST',
      body: {
        'organizationId': _config.organizationId,
        'tripId': tripId,
        'driverId': driverId,
        'busId': busId,
        'latitude': latitude,
        'longitude': longitude,
        if (speedKmh != null) 'speedKmh': speedKmh,
        if (heading != null) 'heading': heading,
        if (crowdLevel != null) 'crowdLevel': crowdLevel,
        if (onBreak != null) 'onBreak': onBreak,
      },
      parser: (_) {},
    );
  }

  Future<RouteLiveSnapshot> getRouteLive(
    String routeId, {
    String? organizationId,
  }) {
    return _request(
      '/api/routes/$routeId/live',
      query: organizationId == null
          ? null
          : {'organizationId': organizationId},
      parser: (data) =>
          RouteLiveSnapshot.fromJson(data as Map<String, dynamic>),
    );
  }

  Future<String> createReminder({
    required String userId,
    required String busId,
    required String routeId,
    required String stopId,
    required String fcmToken,
    int notifyWhenMinutesAway = 5,
  }) {
    return _request(
      '/api/reminders',
      method: 'POST',
      body: {
        'organizationId': _config.organizationId,
        'userId': userId,
        'busId': busId,
        'routeId': routeId,
        'stopId': stopId,
        'fcmToken': fcmToken,
        'notifyWhenMinutesAway': notifyWhenMinutesAway,
      },
      parser: (data) => (data as Map<String, dynamic>)['reminderId'] as String,
    );
  }

  Future<void> cancelReminder(String reminderId) {
    return _request(
      '/api/reminders/$reminderId',
      method: 'DELETE',
      parser: (_) {},
    );
  }

  Future<DriverNavigationRoute> fetchDriverNavigation({
    required GeoPoint origin,
    double? heading,
    required List<GeoPoint> waypoints,
    required GeoPoint destination,
    required String language,
  }) {
    return _request(
      '/api/routing/navigation',
      method: 'POST',
      timeout: const Duration(seconds: 20),
      body: {
        'origin': {
          'latitude': origin.latitude,
          'longitude': origin.longitude,
          if (heading != null) 'heading': heading,
        },
        'waypoints': [
          for (final point in waypoints)
            {'latitude': point.latitude, 'longitude': point.longitude},
        ],
        'destination': {
          'latitude': destination.latitude,
          'longitude': destination.longitude,
        },
        'language': language,
      },
      parser: (data) => DriverNavigationRoute.fromJson(
        data as Map<String, dynamic>,
      ),
    );
  }

  Future<void> deleteDriverAccount() {
    return _request(
      '/api/auth/driver-delete-account',
      method: 'POST',
      body: const {},
      parser: (_) {},
    );
  }

  Future<void> deletePassengerAccount() {
    return _request(
      '/api/auth/passenger-delete-account',
      method: 'POST',
      body: const {},
      parser: (_) {},
    );
  }
}

class DriverNavigationStep {
  const DriverNavigationStep({
    required this.maneuver,
    required this.instruction,
    required this.distanceMeters,
    required this.start,
  });

  final String maneuver;
  final String instruction;
  final double distanceMeters;
  final GeoPoint start;

  factory DriverNavigationStep.fromJson(Map<String, dynamic> json) {
    final start = json['start'];
    final startMap = start is Map<String, dynamic> ? start : <String, dynamic>{};
    return DriverNavigationStep(
      maneuver: json['maneuver'] as String? ?? 'STRAIGHT',
      instruction: json['instruction'] as String? ?? '',
      distanceMeters: (json['distanceMeters'] as num?)?.toDouble() ?? 0,
      start: GeoPoint(
        latitude: (startMap['latitude'] as num?)?.toDouble() ?? 0,
        longitude: (startMap['longitude'] as num?)?.toDouble() ?? 0,
      ),
    );
  }
}

class DriverNavigationRoute {
  const DriverNavigationRoute({
    required this.points,
    required this.distanceMeters,
    required this.durationSeconds,
    required this.steps,
  });

  final List<GeoPoint> points;
  final double distanceMeters;
  final int durationSeconds;
  final List<DriverNavigationStep> steps;

  factory DriverNavigationRoute.fromJson(Map<String, dynamic> json) {
    final rawPoints = json['points'];
    final points = <GeoPoint>[];
    if (rawPoints is List) {
      for (final point in rawPoints) {
        if (point is List && point.length >= 2) {
          points.add(
            GeoPoint(
              latitude: (point[0] as num).toDouble(),
              longitude: (point[1] as num).toDouble(),
            ),
          );
        }
      }
    }
    final rawSteps = json['steps'];
    final steps = rawSteps is List
        ? rawSteps
            .whereType<Map>()
            .map(
              (step) => DriverNavigationStep.fromJson(
                Map<String, dynamic>.from(step),
              ),
            )
            .toList()
        : <DriverNavigationStep>[];
    return DriverNavigationRoute(
      points: points,
      distanceMeters: (json['distanceMeters'] as num?)?.toDouble() ?? 0,
      durationSeconds: (json['durationSeconds'] as num?)?.round() ?? 0,
      steps: steps,
    );
  }
}
