import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AccountType { personal, business }

enum AppLanguage { english, arabic }

class UserSession extends ChangeNotifier {
  UserSession._();

  static final UserSession instance = UserSession._();

  static const _localeKey = 'passenger_locale_v1';
  static const _sessionKey = 'passenger_business_session_v1';

  AccountType? accountType;
  AppLanguage language = AppLanguage.english;
  String? email;
  String? phoneNumber;
  String? businessId;
  String? businessName;
  String? sessionToken;

  Future<void> loadLocale() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_localeKey);
    if (saved != null) {
      language = saved == 'ar' ? AppLanguage.arabic : AppLanguage.english;
    } else {
      applyDeviceLocale();
    }
    await loadBusinessSession();
  }

  Future<void> loadBusinessSession() async {
    final prefs = await SharedPreferences.getInstance();
    sessionToken = prefs.getString('${_sessionKey}_token');
    businessId = prefs.getString('${_sessionKey}_businessId');
    businessName = prefs.getString('${_sessionKey}_businessName');
    email = prefs.getString('${_sessionKey}_email');
    if (sessionToken != null && businessId != null) {
      accountType = AccountType.business;
    }
    notifyListeners();
  }

  void applyDeviceLocale() {
    final code = PlatformDispatcher.instance.locale.languageCode;
    language = code.startsWith('ar') ? AppLanguage.arabic : AppLanguage.english;
  }

  void setAccountType(AccountType type) {
    accountType = type;
    notifyListeners();
  }

  Future<void> setLanguage(AppLanguage language) async {
    this.language = language;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _localeKey,
      language == AppLanguage.arabic ? 'ar' : 'en',
    );
    notifyListeners();
  }

  void setEmail(String value) => email = value;

  void setPhoneNumber(String phone) => phoneNumber = phone;

  Future<void> setBusinessSession({
    required String email,
    required String businessId,
    required String businessName,
    required String sessionToken,
  }) async {
    this.email = email;
    this.businessId = businessId;
    this.businessName = businessName;
    this.sessionToken = sessionToken;
    accountType = AccountType.business;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('${_sessionKey}_token', sessionToken);
    await prefs.setString('${_sessionKey}_businessId', businessId);
    await prefs.setString('${_sessionKey}_businessName', businessName);
    await prefs.setString('${_sessionKey}_email', email);
    notifyListeners();
  }

  Future<void> clearBusinessSession() async {
    sessionToken = null;
    businessId = null;
    businessName = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('${_sessionKey}_token');
    await prefs.remove('${_sessionKey}_businessId');
    await prefs.remove('${_sessionKey}_businessName');
    await prefs.remove('${_sessionKey}_email');
    notifyListeners();
  }

  bool get isBusiness => accountType == AccountType.business;

  bool get isArabic => language == AppLanguage.arabic;

  bool get hasBusinessSession =>
      isBusiness && sessionToken != null && businessId != null;
}
