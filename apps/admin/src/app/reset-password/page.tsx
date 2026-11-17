"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  firebaseApplyActionCode,
  firebaseConfirmPasswordReset,
  firebaseVerifyResetCode,
  mapFirebaseAuthError,
} from "@/lib/firebase/auth.client";
import { getUserErrorMessage } from "@/lib/errorMessage";
import TrddkWordmark from "@/components/TrddkWordmark";

const MFA_KEY = "trddk_admin_mfa";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const oobCode = searchParams.get("oobCode") || "";
  const mode = searchParams.get("mode") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState(false);
  const [loading, setLoading] = useState(Boolean(oobCode));
  const [hasAdminSession, setHasAdminSession] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem(MFA_KEY);
    } catch {
      // ignore
    }
    void fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => setHasAdminSession(res.ok))
      .catch(() => setHasAdminSession(false));
  }, []);

  useEffect(() => {
    if (!oobCode) {
      setLoading(false);
      return;
    }

    if (mode === "verifyEmail" || mode === "recoverEmail") {
      firebaseApplyActionCode(oobCode)
        .then(() => {
          setVerifiedEmail(true);
          setDone(true);
        })
        .catch((err) => setError(mapFirebaseAuthError(err)))
        .finally(() => setLoading(false));
      return;
    }

    firebaseVerifyResetCode(oobCode)
      .then((resetEmail) => setEmail(resetEmail))
      .catch((err) => setError(mapFirebaseAuthError(err)))
      .finally(() => setLoading(false));
  }, [mode, oobCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    if (password !== confirm) {
      setError("تأكيد كلمة المرور غير متطابق.");
      return;
    }
    setLoading(true);
    try {
      if (oobCode) {
        await firebaseConfirmPasswordReset(oobCode, password);
      } else if (token) {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        });
        const body = await res.json();
        if (!res.ok || !body.success) {
          throw new Error(body.error || "تعذّر تغيير كلمة المرور");
        }
      } else {
        throw new Error("رابط الاستعادة غير صالح.");
      }
      setDone(true);
    } catch (err) {
      setError(mapFirebaseAuthError(err) || getUserErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (loading && !password) {
    return <p>جاري التحقق من الرابط...</p>;
  }

  if (done) {
    return (
      <>
        <div className="alert alert-success">
          {verifiedEmail
            ? "تم التحقق من البريد بنجاح."
            : "تم تعيين كلمة المرور بنجاح."}
        </div>
        {hasAdminSession ? (
          <Link href="/dashboard" className="btn btn-primary">
            العودة إلى اللوحة
          </Link>
        ) : (
          <Link href="/login" className="btn btn-primary">
            تسجيل الدخول
          </Link>
        )}
      </>
    );
  }

  if (!token && !oobCode) {
    return (
      <>
        <p>إن انتهيت من تعيين كلمة المرور، سجّل الدخول من هنا.</p>
        <Link href="/login" className="btn btn-primary">
          تسجيل الدخول
        </Link>
      </>
    );
  }

  if (error && !oobCode && !token) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (error && oobCode && !email) {
    return (
      <>
        <div className="alert alert-error">{error}</div>
        <Link href="/login" className="btn btn-ghost">
          تسجيل الدخول
        </Link>
      </>
    );
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      {email ? (
        <p>
          تعيين كلمة المرور لـ <span dir="ltr">{email}</span>
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="new-password">كلمة المرور الجديدة</label>
        <input
          id="new-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="confirm-password">تأكيد كلمة المرور</label>
        <input
          id="confirm-password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? "جاري الحفظ..." : "حفظ كلمة المرور"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-card-header">
          <TrddkWordmark className="login-wordmark" />
          <h1>تعيين كلمة مرور جديدة</h1>
        </div>
        <Suspense fallback={<p>جاري التحميل...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
