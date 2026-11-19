"use client";

import { useState } from "react";
import { requireSaudiMobile } from "@tardadi/shared";
import { adminFetch } from "@/lib/adminFetch";
import { getUserErrorMessage } from "@/lib/errorMessage";

type Props = {
  businessId: string;
  onAdded?: () => void;
};

type AppRole = "passenger" | "driver" | "admin";

const ROLES: { id: AppRole; label: string }[] = [
  { id: "passenger", label: "راكب" },
  { id: "driver", label: "سائق" },
  { id: "admin", label: "أدمن" },
];

export function AddBeneficiaryForm({ businessId, onAdded }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("passenger");
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
    if (role === "admin" && !email.trim()) {
      setError("حساب الأدمن يحتاج بريداً للدخول إلى لوحة الإدارة.");
      return;
    }

    setSaving(true);
    try {
      const created = await adminFetch<{ uid: string }>("/api/users/invite", {
        method: "POST",
        body: JSON.stringify({
          phone: normalizedPhone,
          email: email.trim() || undefined,
          displayName: name.trim(),
          primaryRole: role === "admin" ? "business_admin" : role === "driver" ? "driver" : "employee",
          membershipRole:
            role === "admin" ? "business_admin" : role === "driver" ? "driver" : "employee",
          businessId,
        }),
      });

      if (role === "driver" || role === "admin") {
        await adminFetch(`/api/businesses/${businessId}/employees/${created.uid}`, {
          method: "PATCH",
          body: JSON.stringify({
            phone: normalizedPhone,
            appRole: role,
            passengerAccess: false,
            driverAccess: role === "driver",
            ...(role === "admin" && email.trim() ? { email: email.trim() } : {}),
          }),
        });
      }

      setSuccess(
        role === "driver"
          ? "تمت إضافة السائق. يظهر هنا ويمكن تعيين الخط والباص من التعديل."
          : role === "admin"
            ? "تمت إضافة الأدمن. يدخل لوحة الإدارة بالبريد."
            : "تمت إضافة الراكب. يسجّل دخوله في التطبيق برقم الجوال."
      );
      setName("");
      setPhone("");
      setEmail("");
      setRole("passenger");
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
        الرقم يسجّل كراكب أو سائق أو أدمن. الدخول للتطبيق برقم الجوال، ودخول
        الأدمن للوحة الإدارة بالبريد.
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
        <label>رقم الجوال</label>
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
        <label>الدور</label>
        <div className="role-choices">
          {ROLES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`role-choice ${role === item.id ? "active" : ""}`}
              onClick={() => setRole(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {role === "admin" && (
        <div className="field">
          <label>البريد الإلكتروني</label>
          <input
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            required
          />
        </div>
      )}
      <button className="btn" type="submit" disabled={saving}>
        {saving ? "جاري الإضافة..." : "إضافة"}
      </button>
    </form>
  );
}
