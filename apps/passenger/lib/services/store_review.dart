const storeReviewNationalDigits = '500300001';

bool isPassengerStoreReviewPhone(String raw) {
  final digits = raw.replaceAll(RegExp(r'\D'), '');
  return digits == storeReviewNationalDigits ||
      digits == '966$storeReviewNationalDigits' ||
      digits == '0$storeReviewNationalDigits';
}
