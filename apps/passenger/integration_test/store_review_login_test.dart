import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:tardadi_passenger/main.dart' as app;

Future<void> waitFor(WidgetTester tester, Finder finder) async {
  for (var i = 0; i < 60; i++) {
    await tester.pump(const Duration(milliseconds: 500));
    if (finder.evaluate().isNotEmpty) return;
  }
  fail('Timed out waiting for $finder');
}

Future<void> tapText(WidgetTester tester, String text) async {
  final finder = find.text(text);
  await waitFor(tester, finder);
  await tester.ensureVisible(finder.last);
  await tester.tap(finder.last);
  await tester.pump(const Duration(milliseconds: 600));
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('store review phone reaches public routes only', (tester) async {
    await app.main();

    await tapText(tester, 'Next');
    await tapText(tester, 'Continue');
    await tapText(tester, 'Continue with phone number');

    await waitFor(tester, find.byType(TextField));
    await tester.enterText(find.byType(TextField).first, '511111111');
    await tester.pump();
    await tapText(tester, 'Next');
    await waitFor(
      tester,
      find.text('Use personal mode or your company email for this number.'),
    );

    await tester.enterText(find.byType(TextField).first, '500300001');
    await tester.pump();
    await tapText(tester, 'Next');

    await waitFor(tester, find.text('Enter the verification code'));
    for (final digit in ['8', '4', '7', '2', '9', '1', '6', '3']) {
      await tapText(tester, digit);
    }
    await tapText(tester, 'Verify');

    await waitFor(tester, find.text('Public'));
    expect(find.text('Business'), findsNothing);
    expect(find.textContaining('company'), findsNothing);
  });
}
