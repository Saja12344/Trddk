import 'package:flutter_test/flutter_test.dart';
import 'package:tardadi_passenger/services/store_review.dart';

void main() {
  test('only the store review number is recognized', () {
    expect(isPassengerStoreReviewPhone('500300001'), isTrue);
    expect(isPassengerStoreReviewPhone('+966500300001'), isTrue);
    expect(isPassengerStoreReviewPhone('0500300001'), isTrue);
    expect(isPassengerStoreReviewPhone('511111111'), isFalse);
    expect(isPassengerStoreReviewPhone('+966500000000'), isFalse);
  });
}
