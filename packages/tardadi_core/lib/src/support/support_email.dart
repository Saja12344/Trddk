import 'package:url_launcher/url_launcher.dart';

const tardadiSupportEmail = 'support@tardadi.com';

/// Opens the device mail app addressed to Tardadi support.
Future<bool> openTardadiSupportEmail() {
  return launchUrl(
    Uri(scheme: 'mailto', path: tardadiSupportEmail),
    mode: LaunchMode.externalApplication,
  );
}
