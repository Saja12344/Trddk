import 'package:tardadi_core/src/models/models.dart';
import 'package:tardadi_core/src/utils/eta_utils.dart';
import 'package:test/test.dart';

void main() {
  const origin = GeoPoint(latitude: 24.7136, longitude: 46.6753);

  GeoPoint northOf(double meters) {
    const earth = 6371000.0;
    final dLat = meters / earth * (180 / 3.141592653589793);
    return GeoPoint(latitude: origin.latitude + dLat, longitude: origin.longitude);
  }

  test('passenger ETA clamps a stop at the bus to 1 minute', () {
    expect(estimateEtaMinutes(origin, origin), 1);
  });

  test('passenger ETA crosses 5 minutes just after 2500 m at 30 km/h', () {
    expect(estimateEtaMinutes(origin, northOf(2500)), 5);
    expect(estimateEtaMinutes(origin, northOf(2501)), 6);
  });

  test('haversine matches a 500 m north offset within 1 mm', () {
    final meters = haversineMeters(origin, northOf(500));
    expect((meters - 500).abs(), lessThan(0.001));
  });
}
