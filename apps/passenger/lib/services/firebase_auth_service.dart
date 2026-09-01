import 'package:firebase_auth/firebase_auth.dart';

/// Firebase Authentication helpers for TRDDK Passenger (Employee app).
class PassengerFirebaseAuth {
  PassengerFirebaseAuth._();
  static final PassengerFirebaseAuth instance = PassengerFirebaseAuth._();

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
