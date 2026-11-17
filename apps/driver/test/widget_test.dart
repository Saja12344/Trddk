import 'package:flutter_test/flutter_test.dart';
import 'package:tardadi_driver/screens/login_screen.dart';
import 'package:tardadi_driver/main.dart';

void main() {
  testWidgets('Driver app renders login screen', (tester) async {
    await tester.pumpWidget(const TardadiDriverApp());
    await tester.pumpAndSettle(const Duration(seconds: 4));
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.text('تسجيل الدخول'), findsOneWidget);
  });
}
