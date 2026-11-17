"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  firebaseChangePassword,
  mapFirebaseAuthError,
} from "@/lib/firebase/auth.client";
import { getUserErrorMessage } from "@/lib/errorMessage";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    if (newPassword !== confirm) {
      setError("تأكيد كلمة المرور غير متطابق.");
      return;
    }
    setLoading(true);
    try {
      await firebaseChangePassword(currentPassword, newPassword);
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(mapFirebaseAuthError(err) || getUserErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-card-header">
          <h1>تغيير كلمة المرور</h1>
          <p>أدخل كلمة المرور الحالية ثم كلمة المرور الجديدة.</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label htmlFor="current-password">كلمة المرور الحالية</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new-password">كلمة المرور الجديدة</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
      </div>
    </div>
  );
}
