import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../models/crowd_level.dart';

class AppLocalizations {
  AppLocalizations(this.locale);

  final Locale locale;

  static const supportedLocales = [
    Locale('en'),
    Locale('ar'),
  ];

  static const localizationsDelegates = <LocalizationsDelegate<dynamic>>[
    AppLocalizationsDelegate(),
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ];

  static AppLocalizations of(BuildContext context) {
    final result = Localizations.of<AppLocalizations>(context, AppLocalizations);
    assert(result != null, 'AppLocalizations not found');
    return result!;
  }

  static AppLocalizations? maybeOf(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  bool get isArabic => locale.languageCode == 'ar';

  static final Map<String, Map<String, String>> _strings = {
    'en': {
      'appTitle': 'TRDDK — Driver',
      'preferences': 'Preferences',
      'language': 'Language',
      'notifications': 'Notifications',
      'vehicle': 'Vehicle',
      'changeVehicle': 'Change vehicle',
      'logOut': 'Log out',
      'save': 'Save',
      'languageSaved': 'Language updated',
      'chooseVehicle': 'Choose your vehicle',
      'chooseVehicleHint': 'You can change it later from the menu',
      'change': 'Change',
      'next': 'Next',
      'selectAssignedVehicle': 'Select your assigned vehicle',
      'currentAssignedVehicle': 'Current assigned vehicle',
      'availableVehicles': 'Available vehicles',
      'saveChanges': 'Save changes',
      'verifyYourNumber': 'Verify Your Number',
      'onlyRegisteredNumbers': 'Only numbers registered in the database can be verified',
      'phoneNumber': 'Phone number',
      'needHelp': 'Need help? Contact support',
      'enterPhoneNumber': 'Enter your phone number',
      'enterPhone': 'Enter your phone number',
      'verifyYourPhoneNumber': 'Verify Your Phone Number',
      'enterSixDigitCode': 'Enter the 6-digit code sent to your phone',
      'didntReceiveCode': 'Didn’t receive the code? ',
      'resendCode': 'Resend Code',
      'resendIn': 'Resend in 00:{seconds}',
      'verifying': 'Verifying...',
      'verify': 'Verify',
      'codeResent': 'A new code was sent',
      'enterOtp': 'Enter the 6-digit verification code',
      'demoOtpHint': 'Temporary verification code is 000000',
      'tardadi': 'TRDDK',
      'loginTitle': 'Login',
      'loginSubtitleCredentials':
          'Sign in with the phone number registered for your driver account',
      'loginSubtitlePassword': 'Enter your password',
      'loginSubtitleSetup': 'Create your password from the email link',
      'emailLabel': 'Email',
      'passwordLabel': 'Password',
      'emailHint': 'Enter your email',
      'passwordHint': 'Enter your password',
      'signIn': 'Login',
      'sendCode': 'Send verification code',
      'changePhone': 'Change number',
      'invalidOtp': 'Invalid or expired code. Request a new one.',
      'otpTooMany': 'Too many attempts. Wait and try again.',
      'otpSendFailed': 'Could not send the verification code. Try again.',
      'otpQuota': 'SMS sending is temporarily unavailable. Try again later.',
      'signInAction': 'Sign in now',
      'resendSetupLink': 'Resend link',
      'changeEmail': 'Change email',
      'forgotPassword': 'Forget password?',
      'setupInstructions':
          'Check your email and tap the link to create your password. When done, tap Sign in below.',
      'enterEmail': 'Enter your email',
      'enterEmailPassword': 'Enter email and password',
      'setupLinkSent': 'Password setup link sent to your email.',
      'resetEmailHint':
          'If this email is registered, you will receive a reset link.',
      'firstTimeSetup': 'First time? Send password setup link',
      'noPasswordYet': 'First time here?',
      'createPassword': 'Set up your account',
      'enterPassword': 'Enter your password',
      'distanceFromStart': 'Distance from start',
      'start': 'Start',
      'youCanStart': 'You can start',
      'goCloserToStart': 'Go closer to start',
      'lastGps': 'Last GPS: {gps} • {route} • {vehicle}',
      'offRoute': 'Off route — returning to line',
      'navThen': 'Then {instruction}',
      'navContinue': 'Continue',
      'navVoiceUnavailable':
          'Voice guidance isn’t available on this phone.',
      'navMute': 'Mute voice guidance',
      'navUnmute': 'Turn voice guidance on',
      'endTripTitle': 'End trip?',
      'endTripMessage':
          'Are you sure you want to end this trip? This action will stop live tracking.',
      'cancel': 'Cancel',
      'endTrip': 'End Trip',
      'openTripTitle': 'A trip is already open',
      'openTripMessage':
          'This trip is still open from before. Continue it, or end it and start a new one?',
      'continueOpenTrip': 'Continue trip',
      'startFreshTrip': 'Start a new trip',
      'tripAutoClosed':
          'The trip ended automatically because the location stopped.',
      'startNewTrip': 'Start a new trip',
      'breakStarted': 'Break started',
      'tripResumed': 'Trip resumed',
      'returnRouteStarted': 'Return route started',
      'takeABreak': 'Take a Break',
      'resumeTrip': 'Resume Trip',
      'tripControls': 'Trip controls',
      'tripControlsHint': 'Update crowd level and manage the active trip',
      'crowdLevel': 'Crowd level',
      'tripOptions': 'Trip options',
      'crowdEmpty': 'Empty',
      'crowdModerate': 'Moderate',
      'crowdCrowded': 'Crowded',
      'crowdEmptyHint': 'Few passengers on board',
      'crowdModerateHint': 'Comfortable occupancy',
      'crowdCrowdedHint': 'Bus is getting full',
      'onBreak': 'On break',
      'minutesEta': '{minutes} minutes',
      'tripPaused': 'Trip paused temporarily',
      'estimatedArrival': 'Estimated Time of Arrival',
      'arrived': 'Arrived',
      'confirmed': 'Confirmed',
      'mapStart': 'Start',
      'mapEnd': 'End',
      'cannotStartTrip':
          'Cannot start the trip now. Move closer to the starting point ({distance} remaining).',
      'vehicleBus': 'Bus',
      'vehicleGolf': 'Golf car',
      'vehicleVan': 'Van',
      'vehicleCar': 'Private car',
      'meters': '{value} m',
      'kilometers': '{value} km',
    },
    'ar': {
      'appTitle': 'TRDDK — سائق',
      'preferences': 'التفضيلات',
      'language': 'اللغة',
      'notifications': 'التنبيهات',
      'vehicle': 'المركبة',
      'changeVehicle': 'تغيير المركبة',
      'logOut': 'تسجيل الخروج',
      'save': 'حفظ',
      'languageSaved': 'تم تحديث اللغة',
      'chooseVehicle': 'اختر مركبتك',
      'chooseVehicleHint': 'يمكنك تغييرها لاحقًا من القائمة',
      'change': 'تغيير',
      'next': 'التالي',
      'selectAssignedVehicle': 'اختر المركبة المعيّنة لك',
      'currentAssignedVehicle': 'المركبة المعيّنة حالياً',
      'availableVehicles': 'المركبات المتاحة',
      'saveChanges': 'حفظ التغييرات',
      'verifyYourNumber': 'تحقق من رقمك',
      'onlyRegisteredNumbers': 'يُقبل فقط الأرقام المسجّلة في قاعدة البيانات',
      'phoneNumber': 'رقم الجوال',
      'needHelp': 'تحتاج مساعدة؟ تواصل مع الدعم',
      'enterPhoneNumber': 'أدخل رقم جوالك',
      'enterPhone': 'أدخل رقم الجوال',
      'verifyYourPhoneNumber': 'تحقق من رقم جوالك',
      'enterSixDigitCode': 'أدخل الرمز المكوّن من 6 أرقام المرسل إلى جوالك',
      'didntReceiveCode': 'لم يصلك الرمز؟ ',
      'resendCode': 'إعادة إرسال الرمز',
      'resendIn': 'إعادة الإرسال خلال 00:{seconds}',
      'verifying': 'جاري التحقق...',
      'verify': 'تحقق',
      'codeResent': 'تم إرسال رمز جديد',
      'enterOtp': 'أدخل رمز التحقق المكوّن من 6 أرقام',
      'demoOtpHint': 'رمز التحقق المؤقت هو 000000',
      'tardadi': 'TRDDK',
      'loginTitle': 'تسجيل الدخول',
      'loginSubtitleCredentials':
          'سجّل الدخول برقم الجوال المسجّل لحساب السائق',
      'loginSubtitlePassword': 'أدخل كلمة المرور',
      'loginSubtitleSetup': 'أنشئ كلمة المرور من الرابط في بريدك',
      'emailLabel': 'البريد الإلكتروني',
      'passwordLabel': 'كلمة المرور',
      'emailHint': 'أدخل بريدك الإلكتروني',
      'passwordHint': 'أدخل كلمة المرور',
      'signIn': 'تسجيل الدخول',
      'sendCode': 'إرسال رمز التحقق',
      'changePhone': 'تغيير الرقم',
      'invalidOtp': 'رمز غير صحيح أو منتهي. اطلب رمزاً جديداً.',
      'otpTooMany': 'محاولات كثيرة. انتظر ثم حاول مرة أخرى.',
      'otpSendFailed': 'تعذّر إرسال رمز التحقق. حاول مرة أخرى.',
      'otpQuota': 'إرسال الرسائل متوقف مؤقتاً. حاول لاحقاً.',
      'signInAction': 'تسجيل الدخول الآن',
      'resendSetupLink': 'إعادة إرسال الرابط',
      'changeEmail': 'تغيير البريد',
      'forgotPassword': 'نسيت كلمة المرور؟',
      'setupInstructions':
          'تحقق من بريدك واضغط الرابط لإنشاء كلمة المرور. بعد الانتهاء، اضغط «تسجيل الدخول» بالأسفل.',
      'enterEmail': 'أدخل البريد الإلكتروني',
      'enterEmailPassword': 'أدخل البريد وكلمة المرور',
      'setupLinkSent': 'تم إرسال رابط إنشاء كلمة المرور إلى بريدك.',
      'resetEmailHint':
          'إذا كان البريد مرتبطًا بحساب، فسيصل رابط الاستعادة.',
      'firstTimeSetup': 'أول مرة؟ أرسل رابط إنشاء كلمة المرور',
      'noPasswordYet': 'لم تعيّن كلمة مرور بعد؟',
      'createPassword': 'إنشاء كلمة مرور',
      'enterPassword': 'أدخل كلمة المرور',
      'youCanStart': 'يمكنك البدء',
      'goCloserToStart': 'اقترب من نقطة الانطلاق',
      'distanceFromStart': 'المسافة من نقطة الانطلاق',
      'lastGps': 'آخر GPS: {gps} • {route} • {vehicle}',
      'offRoute': 'خارج المسار — عُدْ إلى الخط',
      'navThen': 'ثم {instruction}',
      'navContinue': 'تابع',
      'navVoiceUnavailable': 'التوجيه الصوتي غير متاح على هذا الجهاز.',
      'navMute': 'كتم التوجيه الصوتي',
      'navUnmute': 'تشغيل التوجيه الصوتي',
      'endTripTitle': 'إنهاء الرحلة؟',
      'endTripMessage':
          'هل أنت متأكّد من إنهاء هذه الرحلة؟ سيتوقّف التتبّع المباشر.',
      'cancel': 'إلغاء',
      'endTrip': 'إنهاء الرحلة',
      'openTripTitle': 'فيه رحلة مفتوحة',
      'openTripMessage':
          'الرحلة السابقة لسا مفتوحة. تبي تكملها، أو تقفلها وتبدأ رحلة جديدة؟',
      'continueOpenTrip': 'أكمل الرحلة',
      'startFreshTrip': 'رحلة جديدة',
      'tripAutoClosed': 'انتهت الرحلة تلقائياً بسبب انقطاع الموقع',
      'startNewTrip': 'بدء رحلة جديدة',
      'breakStarted': 'بدأت الاستراحة',
      'tripResumed': 'استُؤنفت الرحلة',
      'returnRouteStarted': 'بدأ مسار العودة',
      'takeABreak': 'أخِذ استراحةً',
      'resumeTrip': 'استئناف الرحلة',
      'tripControls': 'التحكّم بالرحلة',
      'tripControlsHint': 'حدّث مستوى الازدحام وأدِر الرحلة النشطة',
      'crowdLevel': 'مستوى الازدحام',
      'tripOptions': 'خيارات الرحلة',
      'crowdEmpty': 'خفيف',
      'crowdModerate': 'متوسط',
      'crowdCrowded': 'مزدحم',
      'crowdEmptyHint': 'عددٌ قليلٌ من الركاب',
      'crowdModerateHint': 'إشغالٌ مريح',
      'crowdCrowdedHint': 'ازدحامٌ متزايد',
      'onBreak': 'في استراحة',
      'minutesEta': '{minutes} دقيقة',
      'tripPaused': 'الرحلة متوقّفة مؤقّتاً',
      'estimatedArrival': 'الوقت المتوقّع للوصول',
      'arrived': 'تأكيد الوصول',
      'confirmed': 'تم التأكيد',
      'mapStart': 'نقطة الانطلاق',
      'mapEnd': 'نقطة الوصول',
      'cannotStartTrip':
          'لا يمكن بدء الرحلة الآن. اقترب من نقطة الانطلاق ({distance} متبقية).',
      'vehicleBus': 'حافلة',
      'vehicleGolf': 'عربة غولف',
      'vehicleVan': 'فان',
      'vehicleCar': 'سيارة خاصة',
      'meters': '{value} م',
      'kilometers': '{value} كم',
    },
  };

  String _t(String key) {
    final lang = locale.languageCode;
    return _strings[lang]?[key] ?? _strings['en']![key] ?? key;
  }

  String format(String key, Map<String, String> params) {
    var value = _t(key);
    for (final entry in params.entries) {
      value = value.replaceAll('{${entry.key}}', entry.value);
    }
    return value;
  }

  String get appTitle => _t('appTitle');
  String get preferences => _t('preferences');
  String get language => _t('language');
  String get notifications => _t('notifications');
  String get vehicle => _t('vehicle');
  String get changeVehicle => _t('changeVehicle');
  String get logOut => _t('logOut');
  String get save => _t('save');
  String get languageSaved => _t('languageSaved');
  String get chooseVehicle => _t('chooseVehicle');
  String get chooseVehicleHint => _t('chooseVehicleHint');
  String get change => _t('change');
  String get next => _t('next');
  String get selectAssignedVehicle => _t('selectAssignedVehicle');
  String get currentAssignedVehicle => _t('currentAssignedVehicle');
  String get availableVehicles => _t('availableVehicles');
  String get saveChanges => _t('saveChanges');
  String get verifyYourNumber => _t('verifyYourNumber');
  String get onlyRegisteredNumbers => _t('onlyRegisteredNumbers');
  String get phoneNumber => _t('phoneNumber');
  String get needHelp => _t('needHelp');
  String get enterPhoneNumber => _t('enterPhoneNumber');
  String get enterPhone => _t('enterPhone');
  String get verifyYourPhoneNumber => _t('verifyYourPhoneNumber');
  String get enterSixDigitCode => _t('enterSixDigitCode');
  String get didntReceiveCode => _t('didntReceiveCode');
  String get resendCode => _t('resendCode');
  String resendIn(String seconds) => format('resendIn', {'seconds': seconds});
  String get verifying => _t('verifying');
  String get verify => _t('verify');
  String get codeResent => _t('codeResent');
  String get enterOtp => _t('enterOtp');
  String get demoOtpHint => _t('demoOtpHint');
  String get tardadi => _t('tardadi');
  String get loginTitle => _t('loginTitle');
  String get loginSubtitleCredentials => _t('loginSubtitleCredentials');
  String get loginSubtitlePassword => _t('loginSubtitlePassword');
  String get loginSubtitleSetup => _t('loginSubtitleSetup');
  String get emailLabel => _t('emailLabel');
  String get passwordLabel => _t('passwordLabel');
  String get emailHint => _t('emailHint');
  String get passwordHint => _t('passwordHint');
  String get signIn => _t('signIn');
  String get sendCode => _t('sendCode');
  String get changePhone => _t('changePhone');
  String get invalidOtp => _t('invalidOtp');
  String get otpTooMany => _t('otpTooMany');
  String get otpSendFailed => _t('otpSendFailed');
  String get otpQuota => _t('otpQuota');
  String get signInAction => _t('signInAction');
  String get resendSetupLink => _t('resendSetupLink');
  String get changeEmail => _t('changeEmail');
  String get forgotPassword => _t('forgotPassword');
  String get setupInstructions => _t('setupInstructions');
  String get enterEmail => _t('enterEmail');
  String get enterEmailPassword => _t('enterEmailPassword');
  String get setupLinkSent => _t('setupLinkSent');
  String get resetEmailHint => _t('resetEmailHint');
  String get firstTimeSetup => _t('firstTimeSetup');
  String get noPasswordYet => _t('noPasswordYet');
  String get createPassword => _t('createPassword');
  String get enterPassword => _t('enterPassword');
  String get distanceFromStart => _t('distanceFromStart');
  String get start => _t('start');
  String get youCanStart => _t('youCanStart');
  String get goCloserToStart => _t('goCloserToStart');
  String lastGps({
    required String gps,
    required String route,
    required String vehicle,
  }) =>
      format('lastGps', {'gps': gps, 'route': route, 'vehicle': vehicle});
  String get offRoute => _t('offRoute');
  String navThen(String instruction) =>
      format('navThen', {'instruction': instruction});
  String get navContinue => _t('navContinue');
  String get navVoiceUnavailable => _t('navVoiceUnavailable');
  String get navMute => _t('navMute');
  String get navUnmute => _t('navUnmute');
  String get endTripTitle => _t('endTripTitle');
  String get endTripMessage => _t('endTripMessage');
  String get cancel => _t('cancel');
  String get endTrip => _t('endTrip');
  String get openTripTitle => _t('openTripTitle');
  String get openTripMessage => _t('openTripMessage');
  String get continueOpenTrip => _t('continueOpenTrip');
  String get startFreshTrip => _t('startFreshTrip');
  String get tripAutoClosed => _t('tripAutoClosed');
  String get startNewTrip => _t('startNewTrip');
  String get breakStarted => _t('breakStarted');
  String get tripResumed => _t('tripResumed');
  String get returnRouteStarted => _t('returnRouteStarted');
  String get takeABreak => _t('takeABreak');
  String get resumeTrip => _t('resumeTrip');
  String get tripControls => _t('tripControls');
  String get tripControlsHint => _t('tripControlsHint');
  String get crowdLevel => _t('crowdLevel');
  String get tripOptions => _t('tripOptions');
  String get onBreak => _t('onBreak');
  String minutesEta(int minutes) => format('minutesEta', {'minutes': '$minutes'});
  String get tripPaused => _t('tripPaused');
  String get estimatedArrival => _t('estimatedArrival');
  String get arrived => _t('arrived');
  String get confirmed => _t('confirmed');
  String get mapStart => _t('mapStart');
  String get mapEnd => _t('mapEnd');
  String cannotStartTrip(String distance) =>
      format('cannotStartTrip', {'distance': distance});
  String meters(num value) => format('meters', {'value': '${value.round()}'});
  String kilometers(num value) =>
      format('kilometers', {'value': '${value.round()}'});

  String vehicleLabel(String vehicleKey) => switch (vehicleKey) {
        'Bus' => _t('vehicleBus'),
        'Golf car' => _t('vehicleGolf'),
        'Van' => _t('vehicleVan'),
        'Private car' => _t('vehicleCar'),
        _ => vehicleKey,
      };

  String crowdLevelLabel(CrowdLevel level) => switch (level) {
        CrowdLevel.low => _t('crowdEmpty'),
        CrowdLevel.medium => _t('crowdModerate'),
        CrowdLevel.high => _t('crowdCrowded'),
      };

  String crowdLevelHint(CrowdLevel level) => switch (level) {
        CrowdLevel.low => _t('crowdEmptyHint'),
        CrowdLevel.medium => _t('crowdModerateHint'),
        CrowdLevel.high => _t('crowdCrowdedHint'),
      };

  String formatDistanceKm(double kilometers) {
    if (kilometers < 1) {
      return meters(kilometers * 1000);
    }
    return this.kilometers(kilometers);
  }
}

class AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) =>
      AppLocalizations.supportedLocales
          .any((supported) => supported.languageCode == locale.languageCode);

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture(AppLocalizations(locale));
  }

  @override
  bool shouldReload(covariant LocalizationsDelegate<AppLocalizations> old) =>
      false;
}

extension AppLocalizationsX on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}
