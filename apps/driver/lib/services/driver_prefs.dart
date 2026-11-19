import 'package:shared_preferences/shared_preferences.dart';

/// Local prefs for per-driver onboarding (vehicle pick on first login).
class DriverPrefs {
  DriverPrefs._();

  static final DriverPrefs instance = DriverPrefs._();

  SharedPreferences? _prefs;

  Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  static const _localeKey = 'app_locale_v2';
  static const _otpPhoneKey = 'driver_otp_phone';
  static const _otpAtKey = 'driver_otp_saved_at';
  static const _navVoiceMutedKey = 'nav_voice_muted';
  static const _navVoiceNoticeKey = 'nav_voice_notice_seen';
  static const _notificationsKey = 'driver_notifications_enabled';

  String _setupKey(String driverKey) => 'vehicle_setup_done_$driverKey';
  String _vehicleKey(String driverKey) => 'selected_vehicle_$driverKey';

  Future<String?> getLocaleCode() async {
    await init();
    return _prefs!.getString(_localeKey);
  }

  Future<void> savePendingOtp({required String phone}) async {
    await init();
    await _prefs!.setString(_otpPhoneKey, phone);
    await _prefs!.setInt(_otpAtKey, DateTime.now().millisecondsSinceEpoch);
  }

  Future<String?> getPendingOtpPhone() async {
    await init();
    final phone = _prefs!.getString(_otpPhoneKey);
    final savedAt = _prefs!.getInt(_otpAtKey) ?? 0;
    if (phone == null || phone.isEmpty) return null;
    if (DateTime.now().millisecondsSinceEpoch - savedAt > 8 * 60 * 1000) {
      await clearPendingOtp();
      return null;
    }
    return phone;
  }

  Future<void> clearPendingOtp() async {
    await init();
    await _prefs!.remove(_otpPhoneKey);
    await _prefs!.remove(_otpAtKey);
  }

  Future<void> saveLocaleCode(String code) async {
    await init();
    await _prefs!.setString(_localeKey, code);
  }

  Future<bool> notificationsEnabled() async {
    await init();
    return _prefs!.getBool(_notificationsKey) ?? true;
  }

  Future<void> setNotificationsEnabled(bool enabled) async {
    await init();
    await _prefs!.setBool(_notificationsKey, enabled);
  }

  Future<bool> isNavVoiceMuted() async {
    await init();
    return _prefs!.getBool(_navVoiceMutedKey) ?? false;
  }

  Future<void> setNavVoiceMuted(bool muted) async {
    await init();
    await _prefs!.setBool(_navVoiceMutedKey, muted);
  }

  Future<bool> hasSeenNavVoiceNotice(String languageCode) async {
    await init();
    return _prefs!.getBool('${_navVoiceNoticeKey}_$languageCode') ?? false;
  }

  Future<void> markNavVoiceNoticeSeen(String languageCode) async {
    await init();
    await _prefs!.setBool('${_navVoiceNoticeKey}_$languageCode', true);
  }

  static String driverKey({required String phone, required String driverId}) {
    final normalized = phone.replaceAll(RegExp(r'\s+'), '');
    if (normalized.isNotEmpty) return normalized;
    if (driverId.isNotEmpty) return driverId;
    return 'unknown';
  }

  Future<bool> hasCompletedVehicleSetup(String driverKey) async {
    await init();
    return _prefs!.getBool(_setupKey(driverKey)) ?? false;
  }

  Future<String?> getSelectedVehicle(String driverKey) async {
    await init();
    return _prefs!.getString(_vehicleKey(driverKey));
  }

  Future<void> saveVehicleSetup({
    required String driverKey,
    required String vehicle,
  }) async {
    await init();
    await _prefs!.setBool(_setupKey(driverKey), true);
    await _prefs!.setString(_vehicleKey(driverKey), vehicle);
  }
}
