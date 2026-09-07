"use client";

import { useState } from "react";
import type { CompanyManagerSummary } from "@tardadi/shared";
import { adminFetch } from "@/lib/adminFetch";

type Props = {
  businessId: string;
  manager: CompanyManagerSummary | null;
  onUpdated: () => void;
};

const STATUS_LABELS: Record<string, string> = {
  invitation_pending: "دعوة معلقة",
  email_verified: "إيميل موثّق",
  active: "نشط",
  suspended: "موقوف",
  incomplete: "غير مكتمل",
  invitation_failed: "فشلت الدعوة",
};

export function CompanyManagerPanel({ businessId, manager, onUpdated }: Props) {
  const [email, setEmail] = useState(manager?.email ?? "");
  const [name, setName] = useState(manager?.name ?? "");
  const [phone, setPhone] = useState(manager?.phone ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function resendInvite() {
    setLoading(true);
    setError("");
    try {
      await adminFetch(`/api/businesses/${businessId}/manager/resend-invite`, {
        method: "POST",
        body: "{}",
      });
      setMessage("تم إرسال الدعوة.");
      onUpdated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveManager(replace: boolean) {
    if (!email.trim() || !name.trim()) {
      setError("الاسم والإيميل مطلوبان.");
      return;
    }
    if (
      replace &&
      !window.confirm("استبدال مدير الشركة؟ سيتم إلغاء صلاحيات المدير الحالي.")
    ) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      await adminFetch(`/api/businesses/${businessId}/manager`, {
        method: "PATCH",
        body: JSON.stringify({
          adminName: name.trim(),
          adminEmail: email.trim(),
          adminPhone: phone.trim() || null,
          action: manager?.invitationStatus === "incomplete" ? "migrate_legacy" : "replace",
        }),
      });
      setMessage(replace ? "تم استبدال المدير." : "تم تحديث المدير.");
      onUpdated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card stack">
      <h3>مدير الشركة / Company Manager</h3>
      <p className="muted">
        البريد الإلكتروني مطلوب لتسجيل الدخول. رقم الجوال للتواصل فقط. الدخول يتطلب
        كلمة مرور + رمز تحقق (2FA).
      </p>

      {manager?.incompleteReason && (
        <div className="alert alert-error">{manager.incompleteReason}</div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="grid-2">
        <div className="field">
          <label>الاسم</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>البريد الإلكتروني *</label>
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>الجوال (اختياري)</label>
          <input
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="05xxxxxxxx"
          />
        </div>
      </div>

      {manager && (
        <ul className="muted">
          <li>الدور: business_admin (company manager)</li>
          <li>حالة الحساب: {manager.accountStatus}</li>
          <li>
            حالة الدعوة:{" "}
            {STATUS_LABELS[manager.invitationStatus] ?? manager.invitationStatus}
          </li>
          <li>توثيق الإيميل: {manager.emailVerified ? "نعم" : "لا"}</li>
          <li>2FA: {manager.mfaEnabled ? "مفعّل" : "—"}</li>
          <li>
            آخر دخول:{" "}
            {manager.lastLoginAt
              ? new Date(manager.lastLoginAt).toLocaleString("ar-SA")
              : "—"}
          </li>
        </ul>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-sm"
          disabled={loading}
          onClick={() => void resendInvite()}
        >
          إعادة إرسال الدعوة
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={loading}
          onClick={() => void saveManager(false)}
        >
          {manager?.invitationStatus === "incomplete"
            ? "إضافة إيميل وتفعيل"
            : "تحديث"}
        </button>
        {manager?.uid && (
          <button
            type="button"
            className="btn btn-sm btn-danger"
            disabled={loading}
            onClick={() => void saveManager(true)}
          >
            استبدال المدير
          </button>
        )}
      </div>
    </div>
  );
}
