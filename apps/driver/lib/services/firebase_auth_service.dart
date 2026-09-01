import 'package:firebase_auth/firebase_auth.dart';

/// Firebase Authentication helpers for TRDDK Driver (Email/Password).
class DriverFirebaseAuth {
  DriverFirebaseAuth._();
  static final DriverFirebaseAuth instance = DriverFirebaseAuth._();

  FirebaseAuth get _auth => FirebaseAuth.instance;

  Future<UserCredential> signIn(String email, String password) {
    return _auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
  }

  Future<void> sendPasswordReset(String email) {
    return _auth.sendPasswordResetEmail(email: email.trim());
  }

  Future<String?> idToken() async {
    return _auth.currentUser?.getIdToken();
  }

  Future<void> signOut() => _auth.signOut();
}
