import 'package:firebase_auth/firebase_auth.dart';

/// Firebase Authentication helpers for TRDDK Driver.
class DriverFirebaseAuth {
  DriverFirebaseAuth._();
  static final DriverFirebaseAuth instance = DriverFirebaseAuth._();

  FirebaseAuth get _auth => FirebaseAuth.instance;

  static String toE164(String input) {
    final digits = input.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('966') && digits.length >= 12) {
      return '+$digits';
    }
    if (digits.startsWith('05') && digits.length == 10) {
      return '+966${digits.substring(1)}';
    }
    if (digits.startsWith('5') && digits.length == 9) {
      return '+966$digits';
    }
    if (input.trim().startsWith('+') && digits.isNotEmpty) {
      return '+$digits';
    }
    return digits.isEmpty ? input.trim() : '+$digits';
  }

  Future<UserCredential> signIn(String email, String password) {
    return _auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
  }

  Future<void> sendPasswordReset(String email) {
    return _auth.sendPasswordResetEmail(email: email.trim());
  }

  Future<void> verifyPhoneNumber({
    required String phone,
    required void Function(PhoneAuthCredential credential) verificationCompleted,
    required void Function(FirebaseAuthException error) verificationFailed,
    required void Function(String verificationId, int? resendToken) codeSent,
    required void Function(String verificationId) codeAutoRetrievalTimeout,
    int? forceResendingToken,
  }) {
    return _auth.verifyPhoneNumber(
      phoneNumber: toE164(phone),
      timeout: const Duration(seconds: 60),
      forceResendingToken: forceResendingToken,
      verificationCompleted: verificationCompleted,
      verificationFailed: verificationFailed,
      codeSent: codeSent,
      codeAutoRetrievalTimeout: codeAutoRetrievalTimeout,
    );
  }

  Future<UserCredential> signInWithSmsCode({
    required String verificationId,
    required String smsCode,
  }) {
    final credential = PhoneAuthProvider.credential(
      verificationId: verificationId,
      smsCode: smsCode.trim(),
    );
    return _auth.signInWithCredential(credential);
  }

  Future<UserCredential> signInWithCredential(PhoneAuthCredential credential) {
    return _auth.signInWithCredential(credential);
  }

  Future<String?> idToken() async {
    return _auth.currentUser?.getIdToken();
  }

  Future<void> signOut() => _auth.signOut();
}
