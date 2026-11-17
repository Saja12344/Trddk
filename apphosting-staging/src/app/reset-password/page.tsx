"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { getUserErrorMessage } from "@/lib/errorMessage";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

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
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || "تعذّر تغيير كلمة المرور");
      }
      setDone(true);
    } catch (err) {
      setError(getUserErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="alert alert-error">رابط الاستعادة غير صالح.</div>
    );
  }

  if (done) {
    return (
      <>
        <div className="alert alert-success">تم تغيير كلمة المرور بنجاح.</div>
        <Link href="/login" className="btn btn-primary">
          تسجيل الدخول
        </Link>
      </>
    );
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label htmlFor="new-password">كلمة المرور الجديدة</label>
        <input
          id="new-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          <h1>تعيين كلمة مرور جديدة</h1>
        </div>
        <Suspense fallback={<p>جاري التحميل...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
