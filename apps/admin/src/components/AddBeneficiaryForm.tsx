"use client";

import { useState } from "react";
import { requireSaudiMobile } from "@tardadi/shared";
import { adminFetch } from "@/lib/adminFetch";
import { getUserErrorMessage } from "@/lib/errorMessage";

type Props = {
  businessId: string;
  onAdded?: () => void;
};

export function AddBeneficiaryForm({ businessId, onAdded }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    let normalizedPhone = "";
    try {
      normalizedPhone = requireSaudiMobile(phone);
    } catch (err) {
      setError(getUserErrorMessage(err));
      return;
    }
    setSaving(true);
    try {
      await adminFetch("/api/users/invite", {
        method: "POST",
        body: JSON.stringify({
          phone: normalizedPhone,
          email: email.trim() || undefined,
          displayName: name.trim(),
          primaryRole: "employee",
          membershipRole: "employee",
          businessId,
          employeeNumber: employeeNumber.trim() || null,
          department: department.trim() || null,
        }),
      });
      setSuccess("تمت إضافة المستفيد. يقدر يسجّل دخوله في التطبيق برقم الجوال هذا.");
      setName("");
      setPhone("");
      setEmail("");
      setEmployeeNumber("");
      setDepartment("");
      onAdded?.();
    } catch (err) {
      setError(getUserErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h3>إضافة مستفيد</h3>
      <p className="muted">
        المستفيد هو موظف الشركة الذي يستخدم تطبيق TRDDK كراكب. تسجيل الدخول يكون
        برقم الجوال ورمز التحقق، بدون بريد.
      </p>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      <div className="field">
        <label>الاسم</label>
        <input
          placeholder="مثال: أحمد محمد"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label>رقم الجوال *</label>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="05XXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
          required
        />
      </div>
      <div className="field">
        <label>البريد الإلكتروني (اختياري)</label>
        <input
          type="email"
          placeholder="employee@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          dir="ltr"
        />
      </div>
      <div className="field">
        <label>الرقم الوظيفي (اختياري)</label>
        <input
          placeholder="12345"
          value={employeeNumber}
          onChange={(e) => setEmployeeNumber(e.target.value)}
        />
      </div>
      <div className="field">
        <label>القسم (اختياري)</label>
        <input
          placeholder="مثال: العمليات"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        />
      </div>
      <button className="btn" type="submit" disabled={saving}>
        {saving ? "جاري الإضافة..." : "إضافة مستفيد"}
      </button>
    </form>
  );
}
