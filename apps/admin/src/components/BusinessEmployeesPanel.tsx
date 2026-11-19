"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Bus, Driver, Route } from "@tardadi/shared";
import { requireSaudiMobile } from "@tardadi/shared";
import { adminFetch } from "@/lib/adminFetch";
import { api } from "@/lib/api";

type EmployeeRecord = {
  uid: string;
  email: string;
  phone?: string | null;
  displayName: string;
  status: string;
  roleLabel: string;
  driverId: string | null;
  membership: {
    status: string;
    role: string;
    passengerAccess?: boolean;
    driverAccess?: boolean;
  };
};

type AppRole = "passenger" | "driver" | "admin";
type Filter = "all" | AppRole;

type PersonRow = {
  key: string;
  uid: string | null;
  driverId: string | null;
  name: string;
  phone: string | null;
  email: string;
  role: AppRole | "both";
  status: string;
  driverStatus: string | null;
  routeId: string;
  busId: string;
};

type EditDraft = {
  key: string;
  uid: string | null;
  driverId: string | null;
  name: string;
  phone: string;
  email: string;
  role: AppRole;
  wasBoth: boolean;
  routeId: string;
  busId: string;
};

type Props = {
  businessId: string;
};

const ROLE_LABELS: Record<PersonRow["role"], string> = {
  passenger: "راكب",
  driver: "سائق",
  admin: "أدمن",
  both: "سائق وراكب",
};

function phoneKey(phone?: string | null) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("966")) return digits.slice(3);
  if (digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function statusLabel(status: string) {
  if (status === "active") return "نشط";
  if (status === "suspended" || status === "inactive") return "معطّل";
  if (status === "pending") return "معلّق";
  return status;
}

function employeeRole(employee: EmployeeRecord): PersonRow["role"] {
  if (employee.membership.role === "business_admin") return "admin";
  if (employee.roleLabel === "both") return "both";
  if (employee.roleLabel === "driver" || employee.membership.role === "driver") {
    return "driver";
  }
  return "passenger";
}

export function BusinessEmployeesPanel({ businessId }: Props) {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [message, setMessage] = useState("");
  const [edit, setEdit] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const people = await adminFetch<EmployeeRecord[]>(
        `/api/businesses/${businessId}/employees`
      );
      setEmployees(people);
      try {
        const driverRows = (await api.getDrivers()) as Driver[];
        setDrivers(
          driverRows.filter((driver) => driver.businessId === businessId)
        );
      } catch {
        setDrivers([]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }

    try {
      const [routeRows, busRows] = await Promise.all([
        api.getRoutes() as Promise<Route[]>,
        api.getBuses() as Promise<Bus[]>,
      ]);
      setRoutes(routeRows.filter((route) => route.businessId === businessId));
      setBuses(busRows.filter((bus) => bus.businessId === businessId));
    } catch {
      /* assignment lists are optional until routes exist */
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const driverById = new Map(drivers.map((driver) => [driver.driverId, driver]));
    const usedPhones = new Set<string>();
    const people: PersonRow[] = employees.map((employee) => {
      const role = employeeRole(employee);
      const linked = employee.driverId
        ? driverById.get(employee.driverId)
        : drivers.find((driver) => phoneKey(driver.phone) === phoneKey(employee.phone));
      if (employee.phone) usedPhones.add(phoneKey(employee.phone));
      if (linked?.phone) usedPhones.add(phoneKey(linked.phone));
      const accountStatus =
        employee.status === "suspended" || employee.membership.status === "suspended"
          ? "suspended"
          : employee.status;
      return {
        key: employee.uid,
        uid: employee.uid,
        driverId: linked?.driverId ?? employee.driverId,
        name: employee.displayName,
        phone: employee.phone ?? linked?.phone ?? null,
        email: employee.email,
        role,
        status: accountStatus,
        driverStatus: linked?.status ?? null,
        routeId: linked?.assignedRouteId ?? "",
        busId: linked?.assignedBusId ?? "",
      };
    });

    for (const driver of drivers) {
      if (driver.status === "inactive") continue;
      const key = phoneKey(driver.phone);
      if (key && usedPhones.has(key)) continue;
      people.push({
        key: `driver:${driver.driverId}`,
        uid: null,
        driverId: driver.driverId,
        name: driver.name,
        phone: driver.phone,
        email: "",
        role: "driver",
        status: driver.status === "active" ? "active" : "inactive",
        driverStatus: driver.status,
        routeId: driver.assignedRouteId ?? "",
        busId: driver.assignedBusId ?? "",
      });
    }

    return people.sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [drivers, employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (q) {
        const hay = `${row.name} ${row.phone ?? ""} ${row.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "all") return true;
      if (filter === "driver") return row.role === "driver" || row.role === "both";
      return row.role === filter;
    });
  }, [filter, rows, search]);

  function openEdit(row: PersonRow) {
    setError("");
    setEdit({
      key: row.key,
      uid: row.uid,
      driverId: row.driverId,
      name: row.name,
      phone: row.phone ?? "",
      email: row.email,
      role: row.role === "both" ? "driver" : row.role,
      wasBoth: row.role === "both",
      routeId: row.routeId,
      busId: row.busId,
    });
  }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    setError("");
    setMessage("");
    let phone = "";
    try {
      phone = requireSaudiMobile(edit.phone);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
      return;
    }
    if (edit.role === "admin" && !edit.email.trim()) {
      setError("حساب الأدمن يحتاج بريداً للدخول إلى لوحة الإدارة.");
      setSaving(false);
      return;
    }

    try {
      if (edit.role === "driver") {
        if (!edit.busId) {
          throw new Error("اختر باصاً مربوطاً بخط.");
        }
        await adminFetch("/api/drivers", {
          method: "POST",
          body: JSON.stringify({
            name: edit.name,
            phone,
            busId: edit.busId,
            driverId: edit.driverId,
            keepPassenger: edit.wasBoth,
          }),
        });
      } else if (!edit.uid) {
        const created = await adminFetch<{ uid: string }>("/api/users/invite", {
          method: "POST",
          body: JSON.stringify({
            phone,
            email: edit.email.trim() || undefined,
            displayName: edit.name,
            primaryRole: edit.role === "admin" ? "business_admin" : "employee",
            membershipRole: edit.role === "admin" ? "business_admin" : "employee",
            businessId,
          }),
        });
        if (edit.role === "admin") {
          await adminFetch(`/api/businesses/${businessId}/employees/${created.uid}`, {
            method: "PATCH",
            body: JSON.stringify({
              phone,
              appRole: "admin",
              passengerAccess: false,
              driverAccess: false,
              email: edit.email.trim(),
            }),
          });
        }
      } else {
        await adminFetch(`/api/businesses/${businessId}/employees/${edit.uid}`, {
          method: "PATCH",
          body: JSON.stringify({
            phone,
            appRole: edit.role,
            passengerAccess: edit.role === "passenger",
            driverAccess: false,
            ...(edit.role === "admin" ? { email: edit.email.trim() } : {}),
          }),
        });
      }

      setMessage("تم حفظ التعديل.");
      setEdit(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(row: PersonRow) {
    const disabling = row.status === "active";
    if (
      !window.confirm(
        disabling ? `تعطيل ${row.name}؟` : `تفعيل ${row.name}؟`
      )
    ) {
      return;
    }
    setError("");
    setMessage("");
    try {
      if (row.uid) {
        await adminFetch(`/api/businesses/${businessId}/employees/${row.uid}`, {
          method: "PATCH",
          body: JSON.stringify({ status: disabling ? "suspended" : "active" }),
        });
      } else if (row.driverId) {
        await adminFetch(`/api/drivers/${row.driverId}`, {
          method: "PUT",
          body: JSON.stringify({ status: disabling ? "inactive" : "active" }),
        });
      }
      setMessage(disabling ? "تم التعطيل." : "تم التفعيل.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function removePerson(row: PersonRow) {
    if (!window.confirm(`حذف ${row.name}؟`)) return;
    setError("");
    setMessage("");
    try {
      if (row.uid) {
        await adminFetch(`/api/businesses/${businessId}/employees/${row.uid}`, {
          method: "DELETE",
        });
      }
      if (row.driverId) {
        await adminFetch(`/api/drivers/${row.driverId}`, { method: "DELETE" });
      }
      setMessage("تم الحذف.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="card table-card stack">
      <div className="row spread wrap gap">
        <h3>المستفيدين ({filtered.length})</h3>
        <input
          type="search"
          placeholder="بحث بالاسم أو الجوال"
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
            ["admin", "أدمن"],
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
              <th>الجوال</th>
              <th>الدور</th>
              <th>الخط</th>
              <th>الباص</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.key}>
                <td>{row.name}</td>
                <td dir="ltr">{row.phone || "—"}</td>
                <td>{ROLE_LABELS[row.role]}</td>
                <td>
                  {routes.find((route) => route.routeId === row.routeId)?.name || "—"}
                </td>
                <td>
                  {buses.find((bus) => bus.busId === row.busId)?.label || "—"}
                </td>
                <td>
                  <span
                    className={`badge ${row.status === "active" ? "badge-success" : "badge-muted"}`}
                  >
                    {statusLabel(row.status)}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      type="button"
                      className="action-btn action-btn-edit"
                      onClick={() => openEdit(row)}
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      className="action-btn action-btn-warn"
                      onClick={() => void toggleStatus(row)}
                    >
                      {row.status === "active" ? "تعطيل" : "تفعيل"}
                    </button>
                    <button
                      type="button"
                      className="action-btn action-btn-danger"
                      onClick={() => void removePerson(row)}
                    >
                      حذف
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={7} className="empty-cell">
                  لا يوجد مستفيدون.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {edit && (
        <div className="modal-backdrop" onClick={() => setEdit(null)}>
          <div
            className="card modal-card edit-person-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>تعديل {edit.name}</h3>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEdit(null)}
              >
                إغلاق
              </button>
            </div>
            {edit.wasBoth && (
              <p className="muted">
                هذا الرقم سائق وراكب معاً. اختر دوراً واحداً عند الحفظ.
              </p>
            )}
            <div className="field">
              <label htmlFor="edit-phone">رقم الجوال</label>
              <input
                id="edit-phone"
                type="tel"
                inputMode="numeric"
                dir="ltr"
                placeholder="05XXXXXXXX"
                value={edit.phone}
                onChange={(event) =>
                  setEdit({ ...edit, phone: event.target.value })
                }
              />
            </div>
            <div className="field">
              <label>الدور</label>
              <div className="role-choices">
                {(
                  [
                    ["passenger", "راكب"],
                    ["driver", "سائق"],
                    ["admin", "أدمن"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`role-choice ${edit.role === id ? "active" : ""}`}
                    onClick={() => setEdit({ ...edit, role: id })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {edit.role === "admin" && (
              <div className="field">
                <label htmlFor="edit-email">البريد الإلكتروني</label>
                <input
                  id="edit-email"
                  type="email"
                  dir="ltr"
                  placeholder="name@company.com"
                  value={edit.email}
                  onChange={(event) =>
                    setEdit({ ...edit, email: event.target.value })
                  }
                />
              </div>
            )}
            {edit.role === "driver" && (
              <div className="field">
                <label htmlFor="edit-bus">الباص</label>
                <select
                  id="edit-bus"
                  value={edit.busId}
                  onChange={(event) => {
                    const bus = buses.find((item) => item.busId === event.target.value);
                    setEdit({
                      ...edit,
                      busId: event.target.value,
                      routeId: bus?.routeId ?? "",
                    });
                  }}
                >
                  <option value="">اختر الباص</option>
                  {buses
                    .filter((bus) => bus.routeId)
                    .map((bus) => (
                      <option key={bus.busId} value={bus.busId}>
                        {bus.label}
                        {routes.find((route) => route.routeId === bus.routeId)
                          ? ` · ${routes.find((route) => route.routeId === bus.routeId)?.name}`
                          : ""}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary btn-inline"
                disabled={saving}
                onClick={() => void saveEdit()}
              >
                {saving ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-inline"
                onClick={() => setEdit(null)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
