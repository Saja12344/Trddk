"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  firebaseSendPasswordReset,
  isValidEmail,
  mapFirebaseAuthError,
} from "@/lib/firebase/auth.client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const lastSentAt = useRef(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!isValidEmail(email)) {
      setError("البريد الإلكتروني غير صالح.");
      return;
    }

    const now = Date.now();
    if (now - lastSentAt.current < 30_000) {
      setError("انتظر 30 ثانية قبل إعادة الإرسال.");
      return;
    }

    setLoading(true);
    try {
      await firebaseSendPasswordReset(email);
      lastSentAt.current = now;
      setMessage(
        "إذا كان البريد مرتبطًا بحساب، فسيصل رابط استعادة كلمة المرور."
      );
    } catch (err) {
      const code = (err as { code?: string }).code;
      const msg = (err as Error).message ?? "";
      if (code === "auth/too-many-requests") {
        setError("محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.");
      } else if (msg.includes("Firebase غير مهيأ")) {
        setError(
          "خدمة الاستعادة غير مهيأة. تأكد من إعداد NEXT_PUBLIC_FIREBASE_* ثم أعد تشغيل التطبيق."
        );
      } else {
        setMessage(
          "إذا كان البريد مرتبطًا بحساب، فسيصل رابط استعادة كلمة المرور."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-card-header">
          <h1>نسيت كلمة المرور؟</h1>
          <p>أدخل بريدك الإلكتروني. سنرسل رابط استعادة كلمة المرور عبر TRDDK.</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}
          <div className="field">
            <label htmlFor="forgot-email">البريد الإلكتروني</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              autoComplete="email"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "جاري الإرسال..." : "إرسال رابط الاستعادة"}
          </button>
          <Link href="/login" className="btn btn-ghost">
            العودة لتسجيل الدخول
          </Link>
        </form>
      </div>
    </div>
  );
}
