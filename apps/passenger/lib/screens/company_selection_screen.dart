import 'package:flutter/material.dart';
import 'package:tardadi_core/tardadi_core.dart';

import '../l10n/app_localizations.dart';
import '../services/passenger_api.dart';
import '../services/user_session.dart';
import '../widgets/onboarding/onboarding_scale.dart';
import '../widgets/onboarding/onboarding_theme.dart';
import 'routes_main_screen.dart';

class CompanySelectionScreen extends StatefulWidget {
  const CompanySelectionScreen({
    super.key,
    required this.email,
    required this.verificationToken,
    required this.memberships,
  });

  final String email;
  final String verificationToken;
  final List<PassengerMembershipSummary> memberships;

  @override
  State<CompanySelectionScreen> createState() => _CompanySelectionScreenState();
}

class _CompanySelectionScreenState extends State<CompanySelectionScreen> {
  final _api = createPassengerApi();
  var _loading = false;
  String? _error;

  Future<void> _select(PassengerMembershipSummary membership) async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await _api.passengerBusinessSession(
        verificationToken: widget.verificationToken,
        businessId: membership.businessId,
      );
      final identity = session.email.isNotEmpty
          ? session.email
          : (session.phone.isNotEmpty ? session.phone : widget.email);
      await UserSession.instance.setBusinessSession(
        email: identity,
        phone: session.phone,
        businessId: session.businessId,
        businessName: session.businessName,
        sessionToken: session.sessionToken,
      );
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute<void>(builder: (_) => const RoutesMainScreen()),
        (_) => false,
      );
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scale = OnboardingScale(context);
    final isAr = UserSession.instance.isArabic;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: scale.horizontalPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 32),
              Text(
                isAr ? 'اختر شركتك' : 'Select your company',
                style: TextStyle(
                  fontSize: OnboardingTheme.onboardingTitleSize,
                  fontWeight: FontWeight.w700,
                  color: OnboardingTheme.routeTitle,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                isAr
                    ? 'حسابك مرتبط بأكثر من شركة. اختر الشركة التي تريد عرض مساراتها.'
                    : 'Your account is linked to more than one company. Choose which routes to view.',
                style: TextStyle(
                  fontSize: OnboardingTheme.onboardingSubtitleSize,
                  color: OnboardingTheme.routeMeta,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    _error!,
                    style: const TextStyle(color: Colors.red),
                    textAlign: TextAlign.center,
                  ),
                ),
              Expanded(
                child: ListView.separated(
                  itemCount: widget.memberships.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final m = widget.memberships[index];
                    return Material(
                      color: OnboardingTheme.lightCard,
                      borderRadius: BorderRadius.circular(16),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: _loading ? null : () => _select(m),
                        child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  m.businessName,
                                  style: TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w600,
                                    color: OnboardingTheme.routeTitle,
                                  ),
                                ),
                              ),
                              if (_loading)
                                const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              else
                                const Icon(Icons.chevron_right),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
