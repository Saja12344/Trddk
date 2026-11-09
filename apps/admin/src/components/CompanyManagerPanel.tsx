"use client";

import { useEffect, useRef, useState } from "react";
import type { CompanyManagerSummary } from "@tardadi/shared";
import { adminFetch } from "@/lib/adminFetch";
import { getUserErrorMessage } from "@/lib/errorMessage";

type Props = {
  businessId: string;
  manager: CompanyManagerSummary;
  onUpdated: () => void;
};

const INVITE_COOLDOWN_MS = 60_000;

function cooldownKey(businessId: string) {
  return `trddk-manager-invite:${businessId}`;
}

export function CompanyManagerPanel({ businessId, manager, onUpdated }: Props) {
  const [name, setName] = useState(manager.name ?? "");
  const [email, setEmail] = useState(manager.email ?? "");
  const [phone, setPhone] = useState(manager.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const sendingRef = useRef(false);

  useEffect(() => {
    setName(manager.name ?? "");
    setEmail(manager.email ?? "");
    setPhone(manager.phone ?? "");
  }, [manager.name, manager.email, manager.phone]);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(cooldownKey(businessId)) || 0);
    if (stored > Date.now()) setCooldownUntil(stored);
  }, [businessId]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const cooldownSec = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const inviteLocked = saving || cooldownSec > 0;

  function startCooldown(ms = INVITE_COOLDOWN_MS) {
    const until = Date.now() + ms;
    setCooldownUntil(until);
    window.localStorage.setItem(cooldownKey(businessId), String(until));
  }

  async function sendInvite() {
    if (sendingRef.current || inviteLocked) return;
    setError("");
    setMessage("");
    if (!name.trim() || !email.trim()) {
      setError("الاسم والبريد الإلكتروني مطلوبان لإرسال الدعوة.");
      return;
    }

    sendingRef.current = true;
    setSaving(true);
    try {
      await adminFetch(`/api/businesses/${businessId}/manager`, {
        method: "PATCH",
        body: JSON.stringify({
          adminName: name.trim(),
          adminEmail: email.trim(),
          adminPhone: phone.trim() || null,
        }),
      });
      startCooldown();
      setMessage(
        "حُفظ البريد وأُرسلت دعوة واحدة لتعيين كلمة المرور. مدير الشركة يدخل لوحة الإدارة بالبريد، ثم رمز التحقق يصل على نفس البريد."
      );
      onUpdated();
    } catch (e) {
      const text = getUserErrorMessage(e);
      setError(text);
      const waitMatch = text.match(/انتظر\s+(\d+)/);
      if (waitMatch) {
        startCooldown(Number(waitMatch[1]) * 1000);
      }
    } finally {
      sendingRef.current = false;
      setSaving(false);
    }
  }

  const alreadyInvited = Boolean(manager.email);

  return (
    <div className="card">
      <h3>مدير الشركة</h3>
      <p className="muted">
        يدخل لوحة الإدارة بالبريد الإلكتروني وكلمة المرور، ثم رمز تحقق يُرسل
        على البريد. رقم الجوال للتواصل فقط — ليس لتسجيل الدخول. السائق يسجّل
        دخوله في تطبيق السائق برقم الجوال، بدون إيميل.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="field">
        <label htmlFor="manager-name">الاسم</label>
        <input
          id="manager-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="manager-email">البريد الإلكتروني *</label>
        <input
          id="manager-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          dir="ltr"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="manager-phone">الجوال (اختياري — للتواصل)</label>
        <input
          id="manager-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
          placeholder="05xxxxxxxx"
        />
      </div>

      <ul className="muted" style={{ marginTop: 8 }}>
        <li>الدور: business_admin (مدير الشركة)</li>
        <li>
          حالة الحساب:{" "}
          {manager.accountStatus === "incomplete"
            ? "غير مكتمل — أرسل الدعوة"
            : manager.accountStatus === "pending" &&
                manager.invitationStatus === "invitation_pending"
              ? "بانتظار تعيين كلمة المرور من الإيميل"
              : manager.accountStatus}
        </li>
        <li>
          حالة الدعوة:{" "}
          {manager.invitationStatus === "incomplete"
            ? "لم تُرسل بعد"
            : manager.invitationStatus === "invitation_pending"
              ? "أُرسلت — بانتظار أول دخول"
              : manager.invitationStatus}
        </li>
        <li>توثيق الإيميل: {manager.emailVerified ? "نعم" : "لا"}</li>
        <li>رمز التحقق: يُرسل على البريد عند كل دخول للوحة الإدارة</li>
        <li>آخر دخول: {manager.lastLoginAt || "—"}</li>
      </ul>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={inviteLocked}
          onClick={() => void sendInvite()}
        >
          {saving
            ? "جاري الإرسال..."
            : cooldownSec > 0
              ? `تم الإرسال — انتظر ${cooldownSec}ث`
              : alreadyInvited
                ? "حفظ وإعادة إرسال الدعوة"
                : "حفظ وإرسال الدعوة"}
        </button>
      </div>
    </div>
  );
}
