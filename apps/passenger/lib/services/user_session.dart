import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AccountType { personal, business }

enum AppLanguage { english, arabic }

class UserSession extends ChangeNotifier {
  UserSession._();

  static final UserSession instance = UserSession._();

  static const _localeKey = 'passenger_locale_v1';
  static const _sessionKey = 'passenger_business_session_v1';
  static const _onboardingKey = 'passenger_onboarding_completed_v1';
  static const _accountTypeKey = 'passenger_account_type_v1';
  static const _reviewTokenKey = 'passenger_store_review_token_v1';

  AccountType? accountType;
  bool storeReview = false;
  AppLanguage language = AppLanguage.english;
  String? email;
  String? phoneNumber;
  String? businessId;
  String? businessName;
  String? sessionToken;
  var hasCompletedOnboarding = false;

  Future<void> loadPersistedState() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_localeKey);
    if (saved != null) {
      language = saved == 'ar' ? AppLanguage.arabic : AppLanguage.english;
    } else {
      applyDeviceLocale();
    }

    hasCompletedOnboarding = prefs.getBool(_onboardingKey) ?? false;

    sessionToken = prefs.getString('${_sessionKey}_token');
    businessId = prefs.getString('${_sessionKey}_businessId');
    businessName = prefs.getString('${_sessionKey}_businessName');
    email = prefs.getString('${_sessionKey}_email');

    if (sessionToken != null && businessId != null) {
      accountType = AccountType.business;
      storeReview = false;
      await prefs.remove(_reviewTokenKey);
    } else {
      final reviewToken = prefs.getString(_reviewTokenKey);
      if (reviewToken != null && reviewToken.isNotEmpty) {
        storeReview = true;
        sessionToken = reviewToken;
        businessId = null;
        accountType = AccountType.personal;
      } else {
        storeReview = false;
        final savedType = prefs.getString(_accountTypeKey);
        if (savedType == 'business') {
          accountType = AccountType.business;
        } else if (savedType == 'personal') {
          accountType = AccountType.personal;
        }
      }
    }

    notifyListeners();
  }

  @Deprecated('Use loadPersistedState')
  Future<void> loadLocale() => loadPersistedState();

  void applyDeviceLocale() {
    final code = PlatformDispatcher.instance.locale.languageCode;
    language = code.startsWith('ar') ? AppLanguage.arabic : AppLanguage.english;
  }

  Future<void> markOnboardingCompleted() async {
    hasCompletedOnboarding = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_onboardingKey, true);
    notifyListeners();
  }

  Future<void> setAccountType(AccountType type) async {
    accountType = type;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _accountTypeKey,
      type == AccountType.business ? 'business' : 'personal',
    );
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
    String? phone,
    required String businessId,
    required String businessName,
    required String sessionToken,
  }) async {
    this.email = email;
    if (phone != null && phone.isNotEmpty) phoneNumber = phone;
    this.businessId = businessId;
    this.businessName = businessName;
    this.sessionToken = sessionToken;
    accountType = AccountType.business;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('${_sessionKey}_token', sessionToken);
    await prefs.setString('${_sessionKey}_businessId', businessId);
    await prefs.setString('${_sessionKey}_businessName', businessName);
    await prefs.setString('${_sessionKey}_email', email);
    await prefs.setString(_accountTypeKey, 'business');
    await prefs.remove(_reviewTokenKey);
    storeReview = false;
    notifyListeners();
  }

  Future<void> setStoreReviewSession({
    required String phone,
    required String sessionToken,
  }) async {
    storeReview = true;
    phoneNumber = phone;
    this.sessionToken = sessionToken;
    businessId = null;
    businessName = null;
    email = null;
    accountType = AccountType.personal;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_reviewTokenKey, sessionToken);
    await prefs.setString(_accountTypeKey, 'personal');
    await prefs.remove('${_sessionKey}_token');
    await prefs.remove('${_sessionKey}_businessId');
    await prefs.remove('${_sessionKey}_businessName');
    await prefs.remove('${_sessionKey}_email');
    notifyListeners();
  }

  Future<void> clearBusinessSession() async {
    sessionToken = null;
    businessId = null;
    businessName = null;
    email = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('${_sessionKey}_token');
    await prefs.remove('${_sessionKey}_businessId');
    await prefs.remove('${_sessionKey}_businessName');
    await prefs.remove('${_sessionKey}_email');
    notifyListeners();
  }

  /// Keeps onboarding + account type; clears business login only.
  Future<void> logoutBusiness() async {
    await clearBusinessSession();
  }

  bool get isBusiness => accountType == AccountType.business;

  bool get isArabic => language == AppLanguage.arabic;

  bool get hasBusinessSession =>
      isBusiness && sessionToken != null && businessId != null;

  bool get needsBusinessLogin =>
      hasCompletedOnboarding &&
      accountType == AccountType.business &&
      !hasBusinessSession;
}
