"use client";

import {
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updatePassword,
  type ActionCodeSettings,
  type Auth,
  type User,
} from "firebase/auth";

import { getFirebaseApp } from "./client";

let auth: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!auth) {
    auth = getAuth(app);
  }
  return auth;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/** Continue URL after Firebase password reset (must be an authorized domain). */
export function getPasswordResetActionSettings(): ActionCodeSettings {
  const continueUrl =
    process.env.NEXT_PUBLIC_PASSWORD_RESET_CONTINUE_URL?.trim() ||
    "https://www.tardadi.com/login";

  return {
    url: continueUrl,
    handleCodeInApp: false,
  };
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export async function firebaseSignIn(
  email: string,
  password: string
): Promise<{ user: User; idToken: string }> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    throw new Error("Firebase غير مهيأ. تحقق من إعدادات المشروع.");
  }

  const credential = await signInWithEmailAndPassword(
    firebaseAuth,
    email.trim(),
    password
  );
  const idToken = await credential.user.getIdToken();
  return { user: credential.user, idToken };
}

export async function firebaseSendPasswordReset(email: string): Promise<void> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    throw new Error("Firebase غير مهيأ.");
  }
  await sendPasswordResetEmail(
    firebaseAuth,
    email.trim(),
    getPasswordResetActionSettings()
  );
}

export async function firebaseChangePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth?.currentUser?.email) {
    throw new Error("يجب تسجيل الدخول أولاً.");
  }

  const user = firebaseAuth.currentUser;
  if (!user.email) {
    throw new Error("يجب تسجيل الدخول أولاً.");
  }
  const credential = EmailAuthProvider.credential(
    user.email,
    currentPassword
  );

  try {
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "auth/requires-recent-login") {
      throw new Error("لأسباب أمنية، سجّل الخروج ثم الدخول مجدداً قبل تغيير كلمة المرور.");
    }
    if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
      throw new Error("كلمة المرور الحالية غير صحيحة.");
    }
    if (code === "auth/weak-password") {
      throw new Error("كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.");
    }
    throw err;
  }
}

export function mapFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string }).code;
  switch (code) {
    case "auth/invalid-email":
      return "البريد الإلكتروني غير صالح.";
    case "auth/user-disabled":
      return "الحساب معطّل. تواصل مع الإدارة.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "البريد أو كلمة المرور غير صحيحة.";
    case "auth/too-many-requests":
      return "محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.";
    case "auth/network-request-failed":
      return "تعذّر الاتصال. تحقق من الشبكة.";
    default:
      return (err as Error).message || "حدث خطأ غير متوقع.";
  }
}
