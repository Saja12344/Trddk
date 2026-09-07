"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

type EmployeeRecord = {
  uid: string;
  email: string;
  displayName: string;
  status: string;
  roleLabel: string;
  driverId: string | null;
  driverName: string | null;
  hasPassword: boolean;
  joinedAt: string | null;
  membership: {
    status: string;
    role: string;
    passengerAccess?: boolean;
    driverAccess?: boolean;
  };
};

type Filter =
  | "all"
  | "passenger"
  | "driver"
  | "both"
  | "active"
  | "inactive"
  | "pending";

type Props = {
  businessId: string;
};

const ROLE_LABELS: Record<string, string> = {
  passenger: "راكب",
  driver: "سائق",
  both: "راكب وسائق",
};

export function BusinessEmployeesPanel({ businessId }: Props) {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminFetch<EmployeeRecord[]>(
        `/api/businesses/${businessId}/employees`
      );
      setEmployees(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (q) {
        const hay = `${e.displayName} ${e.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      switch (filter) {
        case "passenger":
          return e.roleLabel === "passenger";
        case "driver":
          return e.roleLabel === "driver";
        case "both":
          return e.roleLabel === "both";
        case "active":
          return e.membership.status === "active" && e.status === "active";
        case "inactive":
          return e.status === "suspended" || e.membership.status === "suspended";
        case "pending":
          return e.membership.status === "pending" || !e.hasPassword;
        default:
          return true;
      }
    });
  }, [employees, search, filter]);

  async function patchEmployee(
    uid: string,
    body: Record<string, unknown>,
    confirmMsg: string
  ) {
    if (!window.confirm(confirmMsg)) return;
    setMessage("");
    try {
      await adminFetch(`/api/businesses/${businessId}/employees/${uid}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setMessage("تم التحديث.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function removeEmployee(uid: string, name: string) {
    if (
      !window.confirm(
        `إزالة "${name}" من الشركة؟ سيتم إلغاء وصوله للمسارات الخاصة مع الإبقاء على السجلات التاريخية.`
      )
    ) {
      return;
    }
    try {
      await adminFetch(`/api/businesses/${businessId}/employees/${uid}`, {
        method: "DELETE",
      });
      setMessage("تمت الإزالة من الشركة.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function resendInvite(uid: string) {
    try {
      await adminFetch(
        `/api/businesses/${businessId}/employees/${uid}/resend-invite`,
        { method: "POST", body: "{}" }
      );
      setMessage("تم إرسال الدعوة.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="card table-card stack">
      <div className="row spread wrap gap">
        <h3>المستفيدين</h3>
        <input
          type="search"
          placeholder="بحث بالاسم أو الإيميل"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
        />
      </div>

      <div className="tabs">
        {(
          [
            ["all", "الكل"],
            ["passenger", "ركاب"],
            ["driver", "سائقون"],
            ["both", "راكب وسائق"],
            ["active", "نشط"],
            ["inactive", "معطل"],
            ["pending", "دعوة معلقة"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab ${filter === id ? "active" : ""}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="muted">جاري التحميل…</p>}
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      {!loading && (
        <table className="data-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الإيميل</th>
              <th>الدور</th>
              <th>حالة الحساب</th>
              <th>الدعوة / الدخول</th>
              <th>تاريخ الإضافة</th>
              <th>سجل السائق</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.uid}>
                <td>{e.displayName}</td>
                <td>{e.email}</td>
                <td>{ROLE_LABELS[e.roleLabel] ?? e.roleLabel}</td>
                <td>{e.status}</td>
                <td>
                  {e.hasPassword ? "كلمة مرور مُفعّلة" : "بانتظار كلمة المرور"}
                  {e.membership.status === "pending" ? " · عضوية معلّقة" : ""}
                </td>
                <td>{e.joinedAt ? new Date(e.joinedAt).toLocaleDateString("ar-SA") : "—"}</td>
                <td>{e.driverName ?? (e.driverId ? e.driverId : "—")}</td>
                <td className="actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() =>
                      patchEmployee(
                        e.uid,
                        { driverAccess: true, passengerAccess: true },
                        `إضافة دور السائق لـ ${e.displayName}؟`
                      )
                    }
                  >
                    تحويل لسائق
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() =>
                      patchEmployee(
                        e.uid,
                        { status: e.status === "suspended" ? "active" : "suspended" },
                        e.status === "suspended"
                          ? `إعادة تفعيل ${e.displayName}؟`
                          : `تعطيل ${e.displayName}؟`
                      )
                    }
                  >
                    {e.status === "suspended" ? "تفعيل" : "تعطيل"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => void resendInvite(e.uid)}
                  >
                    إعادة الدعوة
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => void removeEmployee(e.uid, e.displayName)}
                  >
                    إزالة من الشركة
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="muted">
                  لا يوجد مستفيدون.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
