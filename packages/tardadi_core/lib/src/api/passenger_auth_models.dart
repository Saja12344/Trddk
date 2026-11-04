class PassengerMembershipSummary {
  const PassengerMembershipSummary({
    required this.businessId,
    required this.businessName,
    required this.passengerAccess,
    required this.driverAccess,
    required this.status,
  });

  factory PassengerMembershipSummary.fromJson(Map<String, dynamic> json) {
    return PassengerMembershipSummary(
      businessId: json['businessId'] as String,
      businessName: json['businessName'] as String? ?? json['businessId'] as String,
      passengerAccess: json['passengerAccess'] as bool? ?? true,
      driverAccess: json['driverAccess'] as bool? ?? false,
      status: json['status'] as String? ?? 'active',
    );
  }

  final String businessId;
  final String businessName;
  final bool passengerAccess;
  final bool driverAccess;
  final String status;
}

class PassengerOtpVerifyResult {
  const PassengerOtpVerifyResult({
    required this.verified,
    this.verificationToken,
    this.memberships = const [],
  });

  factory PassengerOtpVerifyResult.fromJson(Map<String, dynamic> json) {
    final membershipsRaw = json['memberships'] as List<dynamic>?;
    return PassengerOtpVerifyResult(
      verified: json['verified'] as bool? ?? true,
      verificationToken: json['verificationToken'] as String?,
      memberships: membershipsRaw
              ?.map(
                (e) => PassengerMembershipSummary.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList() ??
          const [],
    );
  }

  final bool verified;
  final String? verificationToken;
  final List<PassengerMembershipSummary> memberships;
}

class PassengerReviewSessionResult {
  const PassengerReviewSessionResult({
    required this.sessionToken,
    required this.scope,
  });

  factory PassengerReviewSessionResult.fromJson(Map<String, dynamic> json) {
    final businessId = json['businessId'];
    if (businessId != null) {
      throw Exception('Review session cannot be tied to a company.');
    }
    return PassengerReviewSessionResult(
      sessionToken: json['sessionToken'] as String,
      scope: json['scope'] as String? ?? 'public',
    );
  }

  final String sessionToken;
  final String scope;
}

class PassengerBusinessSessionResult {
  const PassengerBusinessSessionResult({
    required this.sessionToken,
    required this.businessId,
    required this.businessName,
    required this.email,
  });

  factory PassengerBusinessSessionResult.fromJson(Map<String, dynamic> json) {
    return PassengerBusinessSessionResult(
      sessionToken: json['sessionToken'] as String,
      businessId: json['businessId'] as String,
      businessName: json['businessName'] as String? ?? json['businessId'] as String,
      email: json['email'] as String,
    );
  }

  final String sessionToken;
  final String businessId;
  final String businessName;
  final String email;
}
