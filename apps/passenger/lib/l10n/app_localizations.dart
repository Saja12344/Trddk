import 'package:flutter/material.dart';

import '../models/route_list_item.dart';
import '../services/user_session.dart';

class AppLocalizations {
  AppLocalizations(this.language);

  final AppLanguage language;

  bool get isArabic => language == AppLanguage.arabic;

  TextDirection get textDirection =>
      isArabic ? TextDirection.rtl : TextDirection.ltr;

  Locale get locale => isArabic ? const Locale('ar') : const Locale('en');

  static AppLocalizations of(BuildContext context) {
    return AppLocaleScope.of(context);
  }

  String get appName => 'TRDDK';

  String get next => isArabic ? 'التالي' : 'Next';
  String get save => isArabic ? 'حفظ' : 'Save';
  String get logout => isArabic ? 'تسجيل الخروج' : 'Log out';
  String get deleteAccount => isArabic ? 'حذف الحساب' : 'Delete account';
  String get deleteAccountTitle =>
      isArabic ? 'حذف الحساب؟' : 'Delete your account?';
  String get deleteAccountBody => isArabic
      ? 'سيتم حذف حسابك وبياناتك الشخصية نهائيًا وتسجيل خروجك، وسيتم إشعار مشرف شركتك. لا يمكن التراجع عن هذا الإجراء.'
      : "Your account and personal data will be permanently deleted and you'll be signed out. Your company admin will be notified. This can't be undone.";
  String get delete => isArabic ? 'حذف' : 'Delete';
  String get deleteAccountDone =>
      isArabic ? 'تم حذف الحساب' : 'Account deleted';
  String get deleteAccountFailed =>
      isArabic ? 'تعذّر حذف الحساب' : "Couldn't delete the account";
  String get retry => isArabic ? 'إعادة المحاولة' : 'Retry';
  String get cancel => isArabic ? 'إلغاء' : 'Cancel';
  String get verify => isArabic ? 'تحقق' : 'Verify';
  String get onboardingStepPlan => isArabic ? '٠١ · خطّط' : '01 · PLAN';

  String get onboardingStepLocate => isArabic ? '٠٢ · موقعك' : '02 · LOCATE';

  String get settings => isArabic ? 'الإعدادات' : 'Settings';
  String get settingsSubtitle => isArabic
      ? 'خصّص اللغة ونوع الحساب'
      : 'Customize language and account mode';
  String get languageTitle => isArabic ? 'اللغة' : 'Language';
  String get mode => isArabic ? 'الوضع' : 'Mode';
  String get business => isArabic ? 'أعمال' : 'Business';
  String get publicMode => isArabic ? 'عام' : 'Public';
  String get eng => 'English';
  String get ar => 'العربية';
  String get accountTypeLabel => isArabic ? 'نوع الحساب' : 'Account type';
  String get continueLabel => isArabic ? 'متابعة' : 'Continue';
  String get businessSignInHint => isArabic
      ? 'سيُطلب منك تسجيل الدخول برقم الجوال'
      : "You'll sign in with your phone number";

  String get onboardingTagline =>
      isArabic ? 'وصل بدون تخمين' : 'Get there with less guesswork';

  String get onboardingTitle1 =>
      isArabic ? 'لا تفوّت باصك' : 'Never miss your bus';

  String get onboardingSubtitle1 => isArabic
      ? 'اعثر على المحطات والمسارات القريبة في ثوانٍ.'
      : 'Find nearby stations and routes in seconds.';

  String get onboardingTitle2 =>
      isArabic ? 'تابع رحلتك مباشرة' : 'Track Your Ride Live';

  String get onboardingSubtitle2 => isArabic
      ? 'اعرف بالضبط أين الباص ومتى سيصل.'
      : 'Know exactly where your bus is and when it will arrive.';

  String get onboardingTitle3 =>
      isArabic ? 'تنقّل بذكاء كل يوم' : 'Travel Smarter Every Day';

  String get onboardingSubtitle3 => isArabic
      ? 'احفظ مساراتك المفضلة، واستقبل التنبيهات، واستمتع بتنقل خالٍ من التوتر.'
      : 'Save favorite routes, receive notifications, and enjoy stress-free commuting.';

  String get allowLocation =>
      isArabic ? 'متابعة' : 'Continue';

  String get locationPermissionTitle => isArabic
      ? 'السماح لـ TRDDK باستخدام\nموقعك؟'
      : "Allow TRDDK to use\nyour location?";

  String get locationPermissionBody => isArabic
      ? 'سيُستخدم موقعك لعرض الأماكن القريبة وتحديثات المرور وتحديد موقعك.'
      : 'Your location will be used to show you nearby places, '
          'traffic updates, and find your location.';

  String get allowOnce => isArabic ? 'السماح مرة واحدة' : 'Allow Once';
  String get allowWhileUsingApp =>
      isArabic ? 'السماح أثناء استخدام التطبيق' : 'Allow While Using App';
  String get dontAllow => isArabic ? 'عدم السماح' : "Don't Allow";
  String get preciseOn => isArabic ? 'دقة: مفعّلة' : 'Precise: On';

  String get accountTypeTitle =>
      isArabic ? 'كيف ستستخدم التطبيق؟' : 'How will you use the application?';

  String get accountTypeSubtitle => isArabic
      ? 'اختر نوع حسابك للمتابعة'
      : 'Choose your account type to continue';

  String get personal => isArabic ? 'شخصي' : 'Personal';

  String get personalSubtitle => isArabic
      ? 'للأفراد والاستخدام الشخصي اليومي'
      : 'For individuals and everyday personal use';

  String get businessSubtitle => isArabic
      ? 'للمنظمات والشركات المسجلة فقط'
      : 'For registered organizations and companies only';

  String get businessNote => isArabic
      ? 'تسجيل الدخول برقم الجوال. الإيميل خطوة تحقق لاحقة عند الحاجة.'
      : 'Sign in with your phone number. Email is only a later verification step.';

  String get personalNote => isArabic
      ? 'الحساب الشخصي (عام) لا يحتاج تسجيل دخول — انتقل مباشرة للخطوط العامة'
      : 'Personal (public) mode needs no login — go straight to public routes';

  String get verifyYourNumber =>
      isArabic ? 'تحقق من رقمك' : 'Verify Your Number';

  String get verifyPhoneTitle =>
      isArabic ? 'تحقق من رقم هاتفك' : 'Verify Your Phone Number';

  String get verifyPhoneSubtitle => isArabic
      ? 'أدخل الرمز المكوّن من 6 أرقام المرسل إلى هاتفك'
      : 'Enter the 6-digit code sent to your phone';

  String get verifyNumberSubtitle => isArabic
      ? 'يتم التحقق فقط من الأرقام المسجلة في قاعدة البيانات'
      : 'Only numbers registered in the database can be verified';

  String get phoneNumber => isArabic ? 'رقم الجوال' : 'Phone number';
  String get phonePlaceholder =>
      isArabic ? 'أدخل رقم جوالك' : 'Enter your phone number';
  String get invalidPhone =>
      isArabic ? 'أدخل رقم جوال صحيح' : 'Enter a valid phone number';

  String get phoneLogin =>
      isArabic ? 'الدخول برقم الجوال' : 'Continue with phone number';

  String get phoneNotRegistered => isArabic
      ? 'رقم الجوال غير مسجل في أي شركة. تواصل مع الإدارة.'
      : 'This number is not registered with any company.';

  String get tooManyAttempts => isArabic
      ? 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.'
      : 'Too many attempts. Wait a moment and try again.';

  String get otpSendFailed => isArabic
      ? 'تعذر إرسال رمز التحقق. حاول مرة أخرى.'
      : 'Could not send the verification code. Try again.';

  String get phoneLoginUnavailable => isArabic
      ? 'هذا الرقم غير مفعّل لتسجيل الدخول.'
      : 'This phone number is not enabled for sign-in.';

  String get reviewCodeSubtitle =>
      isArabic ? 'أدخل رمز التحقق' : 'Enter the verification code';

  String get reviewCodeRejected => isArabic
      ? 'رمز التحقق غير صحيح.'
      : 'The verification code is incorrect.';

  String get enterYourEmail =>
      isArabic ? 'أدخل بريدك الإلكتروني' : 'Enter your email';

  String get emailOtpSubtitle => isArabic
      ? 'سنرسل رمز تحقق إلى بريدك'
      : 'We will send a verification code to your email';

  String get sendVerificationCode =>
      isArabic ? 'إرسال رمز التحقق' : 'Send verification code';

  String get emailHint =>
      isArabic ? 'name@company.com' : 'name@company.com';

  String get enterValidEmail => isArabic
      ? 'أدخل بريداً إلكترونياً صحيحاً'
      : 'Enter a valid email address';

  String get verifyEmailTitle =>
      isArabic ? 'تحقق من بريدك' : 'Verify your email';

  String get verifyEmailSubtitle => isArabic
      ? 'أدخل الرمز المكوّن من 6 أرقام المرسل إلى بريدك'
      : 'Enter the 6-digit code sent to your email';

  String get contactSupport =>
      isArabic ? 'تحتاج مساعدة؟ تواصل مع الدعم' : 'Need help? Contact support';

  String get didntReceiveCode =>
      isArabic ? 'لم يصلك الرمز؟ ' : "Didn't receive the code? ";

  String resendIn(String timer) =>
      isArabic ? 'إعادة الإرسال خلال $timer' : 'Resend in $timer';

  String codeExpiresIn(String timer) => isArabic
      ? 'ينتهي الرمز خلال $timer'
      : 'Code expires in $timer';

  String get resendCode => isArabic ? 'إعادة إرسال الرمز' : 'Resend Code';

  String get emailNotRegisteredWithCompany => isArabic
      ? 'هذا البريد غير مسجّل لدى شركتك. تأكد أنك اخترت «أعمال» وليس «شخصي»، أو تواصل مع الإدارة.'
      : 'This email is not registered with your company. Choose Business (not Personal), or contact your employer.';

  String get chooseBusinessModeError => isArabic
      ? 'تأكد أنك اخترت «أعمال» عند الدخول. إذا استمرت المشكلة تواصل مع الإدارة.'
      : 'Choose Business mode on login. If this persists, contact your employer.';

  String get invalidOrExpiredOtp => isArabic
      ? 'رمز غير صحيح أو منتهي. اطلب «إعادة إرسال» واستخدم آخر رمز وصلك.'
      : 'Invalid or expired code. Tap Resend and use the latest code.';

  String get tooManyOtpAttempts => isArabic
      ? 'محاولات كثيرة. اطلب رمزاً جديداً.'
      : 'Too many attempts. Request a new code.';

  String get stationSearchHint =>
      isArabic ? 'رقم الباص' : 'Bus number';

  String get noRoutesFound =>
      isArabic ? 'لا توجد مسارات' : 'No routes found';

  String get publicSection => isArabic ? 'عام' : 'Public';

  String get liveBadge => isArabic ? 'مباشر' : 'Live';
  String get etaUnit => isArabic ? 'دقيقة' : 'min';
  String get etaNow => isArabic ? 'الآن' : 'Now';

  String get noLiveBuses =>
      isArabic ? 'لا يوجد باص حالياً' : 'No bus available';

  String liveBusesOnRoute(int count) => isArabic
      ? '$count باص محدّث'
      : '$count live bus${count == 1 ? '' : 'es'}';

  String minutesLabel(int minutes) {
    if (minutes <= 0) return isArabic ? '—' : '—';
    return isArabic
        ? '$minutes د'
        : '$minutes min';
  }

  String routeStopTitle(String routeName, String stopLabel) {
    final name = localizeRouteName(routeName);
    return '$name - $stopLabel';
  }

  String localizeRouteName(String name) {
    if (!isArabic) return name;

    return switch (name.toLowerCase()) {
      'diriyah' => 'الدرعية',
      'roshan' => 'روشن',
      'avindar' => 'أفندار',
      'tkaful alrajhin' => 'تكافل الراجحي',
      _ => name,
    };
  }

  /// Route name in the current language. Uses the API's automatic
  /// translation (nameAr / nameEn) and falls back to the original name.
  String routeDisplayName(RouteListItem route) {
    String? clean(String? v) => (v == null || v.trim().isEmpty) ? null : v.trim();
    if (isArabic) {
      return clean(route.nameAr) ?? localizeRouteName(route.name);
    }
    return clean(route.nameEn) ?? route.name;
  }

  bool routeNameMatchesQuery(String routeName, String query) {
    if (query.isEmpty) return true;
    final normalized = query.toLowerCase();
    return routeName.toLowerCase().contains(normalized) ||
        localizeRouteName(routeName).toLowerCase().contains(normalized);
  }

  String vehicleLabel(VehicleType type, String fallbackName) {
    return switch (type) {
      VehicleType.golfCar => isArabic ? 'عربة جولف' : 'Golf car',
      VehicleType.vanCar => isArabic ? 'فان' : 'Van car',
      VehicleType.bus => fallbackName.startsWith('Bus')
          ? (isArabic
              ? fallbackName.replaceFirst('Bus', 'باص ')
              : fallbackName)
          : (isArabic ? 'باص' : fallbackName),
    };
  }

  String crowdingLabel(String value) {
    return switch (value.toLowerCase()) {
      'low' => isArabic ? 'ازدحام منخفض' : 'Low crowding',
      'medium' => isArabic ? 'ازدحام متوسط' : 'Moderate crowding',
      'high' => isArabic ? 'ازدحام عالي' : 'High crowding',
      _ => value,
    };
  }

  String localizeMetaLabel(String value) {
    if (value == 'Live' || value == 'Scheduled') {
      return isArabic
          ? (value == 'Live' ? 'مباشر' : 'مجدول')
          : value;
    }
    final liveMatch = RegExp(r'^(\d+) live / (\d+)$').firstMatch(value);
    if (liveMatch != null) {
      final live = liveMatch.group(1)!;
      final total = liveMatch.group(2)!;
      return isArabic ? '$live محدّث من $total' : value;
    }
    if (value.contains('Every') && value.contains('min')) {
      final match = RegExp(r'(\d+)').firstMatch(value);
      final minutes = match?.group(1) ?? '5';
      return isArabic ? 'كل $minutes د' : value;
    }
    if (value.contains('Buses')) {
      final match = RegExp(r'(\d+)').firstMatch(value);
      final count = match?.group(1) ?? '0';
      return isArabic ? '$count باص' : value;
    }
    if (value.contains('Stations')) {
      final match = RegExp(r'(\d+)').firstMatch(value);
      final count = match?.group(1) ?? '0';
      return isArabic ? '$count محطة' : value;
    }
    return value;
  }

  String notificationsOn(String busName) =>
      isArabic ? 'تم تفعيل التنبيهات لـ $busName' : 'Notifications on for $busName';

  String notificationsOff(String busName) =>
      isArabic ? 'تم إيقاف التنبيهات لـ $busName' : 'Notifications off for $busName';

  String busArrived(String busName) => isArabic
      ? 'وصل $busName إلى محطتك'
      : '$busName has arrived at your stop';

  String busMinutesAway(String busName, int minutes) => isArabic
      ? '$busName على بعد $minutes د'
      : '$busName is $minutes min away';

  String get notificationsPermissionDenied => isArabic
      ? 'فعّل الإشعارات من إعدادات الجهاز لتلقي تنبيهات الباص'
      : 'Enable notifications in device settings to get bus alerts';

  String get locationOffTitle =>
      isArabic ? 'الموقع غير مفعّل' : 'Location is off';

  String get locationDeniedMessage => isArabic
      ? 'فعّل صلاحية الموقع لتطبيق ترددك عشان نعرض موقعك والباصات القريبة منك على الخريطة.'
      : 'Allow location access for TRDDK so we can show you and nearby buses on the map.';

  String get locationServiceOffMessage => isArabic
      ? 'خدمة الموقع في جهازك مقفلة. شغّلها عشان نعرض موقعك على الخريطة.'
      : 'Location services are turned off on your device. Turn them on to see your position on the map.';

  String get openSettings => isArabic ? 'فتح الإعدادات' : 'Open settings';

  String get locationAllowButton => isArabic ? 'السماح' : 'Allow';

  String get notNow => isArabic ? 'ليس الآن' : 'Not now';
}

class AppLocaleScope extends InheritedWidget {
  const AppLocaleScope({
    super.key,
    required this.localizations,
    required super.child,
  });

  final AppLocalizations localizations;

  static AppLocalizations of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppLocaleScope>();
    assert(scope != null, 'AppLocaleScope not found in widget tree');
    return scope!.localizations;
  }

  @override
  bool updateShouldNotify(AppLocaleScope oldWidget) {
    return oldWidget.localizations.language != localizations.language;
  }
}

extension AppLocalizationsContext on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}
