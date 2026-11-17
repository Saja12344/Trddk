"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getUserErrorMessage } from "@/lib/errorMessage";

export default function SettingsPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
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
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || "تعذّر تغيير كلمة المرور");
      }
      setMessage("تم تغيير كلمة المرور بنجاح.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      router.refresh();
    } catch (err) {
      setError(getUserErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>الإعدادات</h1>
      </header>
      <section className="card" style={{ maxWidth: 480 }}>
        <h2>تغيير كلمة المرور</h2>
        <form className="stack-form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}
          <div className="field">
            <label htmlFor="settings-current">كلمة المرور الحالية</label>
            <input
              id="settings-current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="settings-new">كلمة المرور الجديدة</label>
            <input
              id="settings-new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="settings-confirm">تأكيد كلمة المرور</label>
            <input
              id="settings-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "جاري الحفظ..." : "حفظ"}
          </button>
        </form>
      </section>
    </div>
  );
}
