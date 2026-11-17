"use client";

import { useEffect, useMemo, useState } from "react";
import type { Bus, Driver, Route, Trip } from "@tardadi/shared";
import { api } from "@/lib/api";
import { adminFetch } from "@/lib/adminFetch";
import { getUserErrorMessage } from "@/lib/errorMessage";
import SelectInput from "@/components/SelectInput";
import BusinessBadge from "@/components/BusinessBadge";
import { useBusinessMap, useShowBusinessColumn } from "@/hooks/useBusinessMap";
import { useAuth } from "@/components/AuthProvider";

type AddMode = "existing" | "new";

type EligibleEmployee = {
  uid: string;
  email: string;
  displayName: string;
  roleLabel: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDurationMinutes(start?: string | null, end?: string | null) {
  if (!start || !end) return "—";
  const minutes = Math.max(
    1,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  );
  return `${minutes} د`;
}

export default function DriversPage() {
  const { user } = useAuth();
  const businessMap = useBusinessMap();
  const showBusiness = useShowBusinessColumn();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [detailDriver, setDetailDriver] = useState<Driver | null>(null);
  const [addMode, setAddMode] = useState<AddMode>("existing");
  const [eligibleEmployees, setEligibleEmployees] = useState<EligibleEmployee[]>([]);
  const [selectedEmployeeUid, setSelectedEmployeeUid] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [assignedRouteId, setAssignedRouteId] = useState("");
  const [assignedBusId, setAssignedBusId] = useState("");
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const contextBusinessId = user?.businessId ?? "";

  const scopedRoutes = useMemo(() => {
    const biz = editingDriver?.businessId || contextBusinessId;
    if (!biz) return routes;
    return routes.filter((route) => route.businessId === biz);
  }, [routes, editingDriver, contextBusinessId]);

  const scopedBuses = useMemo(() => {
    const biz = editingDriver?.businessId || contextBusinessId;
    if (!biz) return buses;
    return buses.filter((bus) => bus.businessId === biz);
  }, [buses, editingDriver, contextBusinessId]);

  async function loadEligibleEmployees(businessId: string) {
    if (!businessId) {
      setEligibleEmployees([]);
      return;
    }
    try {
      const employees = await adminFetch<
        Array<{
          uid: string;
          email: string;
          displayName: string;
          roleLabel: string;
          driverId: string | null;
        }>
      >(`/api/businesses/${businessId}/employees`);
      setEligibleEmployees(
        employees
          .filter((e) => !e.driverId && e.roleLabel !== "driver")
          .map((e) => ({
            uid: e.uid,
            email: e.email,
            displayName: e.displayName,
            roleLabel: e.roleLabel,
          }))
      );
    } catch {
      setEligibleEmployees([]);
    }
  }

  async function load() {
    setError("");
    try {
      setRoutes((await api.getRoutes()) as Route[]);
    } catch (e) {
      setError(`تعذر تحميل الخطوط: ${getUserErrorMessage(e)}`);
    }

    try {
      setBuses((await api.getBuses()) as Bus[]);
    } catch (e) {
      setError(`تعذر تحميل الباصات: ${getUserErrorMessage(e)}`);
    }

    try {
      setDrivers((await api.getDrivers()) as Driver[]);
    } catch (e) {
      setError(`تعذر تحميل السائقين: ${getUserErrorMessage(e)}`);
    }

    try {
      setActiveTrips((await api.getTrips("active")) as Trip[]);
    } catch (e) {
      setError(`تعذر تحميل الرحلات النشطة: ${getUserErrorMessage(e)}`);
    }

    if (contextBusinessId) {
      await loadEligibleEmployees(contextBusinessId);
    }
  }

  function resetForm() {
    setAddMode("existing");
    setSelectedEmployeeUid("");
    setName("");
    setPhone("");
    setEmail("");
    setAssignedRouteId("");
    setAssignedBusId("");
    setEditingDriver(null);
  }

  function startEdit(driver: Driver) {
    setEditingDriver(driver);
    setName(driver.name);
    setPhone(driver.phone);
    setEmail(driver.email || "");
    setAssignedRouteId(driver.assignedRouteId || "");
    setAssignedBusId(driver.assignedBusId || "");
    setError("");
    setSuccess("");
  }

  function onSelectEmployee(uid: string) {
    setSelectedEmployeeUid(uid);
    const employee = eligibleEmployees.find((e) => e.uid === uid);
    if (employee) {
      setName(employee.displayName);
      setEmail(employee.email);
    }
  }

  async function saveDriver(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    const payload = {
      name,
      phone,
      email: email.trim() || null,
      assignedRouteId,
      assignedBusId,
    };

    try {
      if (editingDriver) {
        await adminFetch(
          `/api/drivers/${editingDriver.driverId}?businessId=${encodeURIComponent(editingDriver.businessId)}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
        setSuccess(
          email.trim() && !editingDriver.email
            ? "تم تحديث السائق. سيصل له بريد لتعيين كلمة المرور."
            : "تم تحديث بيانات السائق."
        );
      } else if (addMode === "existing") {
        if (!selectedEmployeeUid) {
          setError("اختر موظفاً من الشركة.");
          setSaving(false);
          return;
        }
        await adminFetch("/api/drivers", {
          method: "POST",
          body: JSON.stringify({
            employeeUid: selectedEmployeeUid,
            phone,
            assignedRouteId,
            assignedBusId,
          }),
        });
        setSuccess("تم إضافة دور السائق للموظف.");
      } else {
        await adminFetch("/api/drivers", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            email: email.trim() || undefined,
          }),
        });
        setSuccess(
          email.trim()
            ? "تمت إضافة السائق. سيصل له بريد لإنشاء كلمة المرور."
            : "تمت إضافة السائق. أضف بريده الإلكتروني ليتمكن من الدخول."
        );
      }

      resetForm();
      await load();
    } catch (err) {
      setError(getUserErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (contextBusinessId) {
      void loadEligibleEmployees(contextBusinessId);
    }
  }, [contextBusinessId]);

  const routeOptions = editingDriver ? scopedRoutes : scopedRoutes;
  const busOptions = editingDriver ? scopedBuses : scopedBuses;
  const detailTrip = detailDriver
    ? activeTrips.find((trip) => trip.driverId === detailDriver.driverId)
    : null;

  return (
    <>
      <div className="page-header">
        <h1>السائقين</h1>
        <p>
          أضف سائقاً من موظف موجود أو شخص جديد. لن يُنشأ حساب مكرر إذا كان
          البريد مسجلاً مسبقاً.
        </p>
      </div>

      <div className="grid-2">
        <form className="card" onSubmit={saveDriver}>
          <h3>{editingDriver ? "تعديل سائق" : "إضافة سائق"}</h3>
          {editingDriver && showBusiness && (
            <p className="muted" style={{ marginBottom: 12 }}>
              الشركة: {businessMap[editingDriver.businessId] || editingDriver.businessId}
            </p>
          )}
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {!editingDriver && (
            <>
              <div className="tabs" style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  className={`tab ${addMode === "existing" ? "active" : ""}`}
                  onClick={() => setAddMode("existing")}
                >
                  موظف موجود
                </button>
                <button
                  type="button"
                  className={`tab ${addMode === "new" ? "active" : ""}`}
                  onClick={() => setAddMode("new")}
                >
                  شخص جديد
                </button>
              </div>

              {addMode === "existing" ? (
                <div className="field">
                  <label>اختر موظفاً</label>
                  <SelectInput
                    value={selectedEmployeeUid}
                    onChange={(e) => onSelectEmployee(e.target.value)}
                    required
                  >
                    <option value="">اختر موظفاً (راكب)</option>
                    {eligibleEmployees.map((emp) => (
                      <option key={emp.uid} value={emp.uid}>
                        {emp.displayName} · {emp.email}
                      </option>
                    ))}
                  </SelectInput>
                  {!eligibleEmployees.length && contextBusinessId && (
                    <p className="muted">
                      لا يوجد موظفون مؤهلون. استورد موظفين أو اختر «شخص جديد».
                    </p>
                  )}
                </div>
              ) : null}
            </>
          )}

          {(editingDriver || addMode === "new") && (
            <div className="field">
              <label>اسم السائق</label>
              <input
                placeholder="مثال: أحمد علي"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={addMode === "new" || Boolean(editingDriver)}
                readOnly={addMode === "existing" && Boolean(selectedEmployeeUid)}
              />
            </div>
          )}

          <div className="field">
            <label>رقم الجوال</label>
            <input
              placeholder="05xxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          {(editingDriver || addMode === "new") && (
            <div className="field">
              <label>البريد الإلكتروني (للدخول بالإيميل)</label>
              <input
                type="email"
                placeholder="driver@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
              />
            </div>
          )}

          <div className="field">
            <label>الخط المسموح</label>
            <SelectInput
              value={assignedRouteId}
              onChange={(e) => setAssignedRouteId(e.target.value)}
              required
            >
              <option value="">اختر الخط</option>
              {routeOptions.map((route) => (
                <option key={route.routeId} value={route.routeId}>
                  {showBusiness && businessMap[route.businessId]
                    ? `${businessMap[route.businessId]} · `
                    : ""}
                  {route.name}
                </option>
              ))}
            </SelectInput>
          </div>

          <div className="field">
            <label>الباص المعيّن</label>
            <SelectInput
              value={assignedBusId}
              onChange={(e) => setAssignedBusId(e.target.value)}
              required
            >
              <option value="">اختر الباص</option>
              {busOptions.map((bus) => (
                <option key={bus.busId} value={bus.busId}>
                  {showBusiness && businessMap[bus.businessId]
                    ? `${businessMap[bus.businessId]} · `
                    : ""}
                  {bus.label}
                </option>
              ))}
            </SelectInput>
          </div>

          {busOptions.length === 0 && (
            <div className="alert alert-error">
              لا توجد باصات. أضف باصاً أولاً من صفحة الباصات.
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "جاري الحفظ..." : editingDriver ? "حفظ التعديلات" : "حفظ السائق"}
            </button>
            {editingDriver && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
              >
                إلغاء
              </button>
            )}
          </div>
        </form>

        <div className="card table-card">
          <h3>قائمة السائقين</h3>
          <table className="data-table">
            <thead>
              <tr>
                {showBusiness && <th>الشركة</th>}
                <th>الاسم</th>
                <th>الجوال</th>
                <th>الإيميل</th>
                <th>الحالة</th>
                <th>الرحلة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => {
                const businessLabel =
                  businessMap[driver.businessId] || driver.businessId || "—";
                const trip = activeTrips.find(
                  (item) => item.driverId === driver.driverId
                );
                const onBreak = trip?.onBreak === true;
                return (
                  <tr key={`${driver.businessId}-${driver.driverId}`}>
                    {showBusiness && (
                      <td>
                        <BusinessBadge name={businessLabel} />
                      </td>
                    )}
                    <td>{driver.name}</td>
                    <td dir="ltr">{driver.phone}</td>
                    <td dir="ltr">{driver.email || "—"}</td>
                    <td>{driver.status}</td>
                    <td>
                      {!trip ? (
                        <span className="chip">غير نشط</span>
                      ) : onBreak ? (
                        <span className="chip chip-warn">في استراحة</span>
                      ) : (
                        <span className="chip chip-success">في رحلة</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => setDetailDriver(driver)}
                      >
                        تفاصيل
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => startEdit(driver)}
                      >
                        تعديل
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!drivers.length && (
                <tr>
                  <td colSpan={showBusiness ? 8 : 7} className="muted">
                    لا يوجد سائقون.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailDriver && (
        <div className="modal-backdrop" onClick={() => setDetailDriver(null)}>
          <div
            className="card modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{detailDriver.name}</h3>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDetailDriver(null)}
              >
                إغلاق
              </button>
            </div>

            <p dir="ltr">{detailDriver.phone}</p>

            {!detailTrip ? (
              <div className="alert">لا توجد رحلة نشطة لهذا السائق.</div>
            ) : (
              <>
                <div className="detail-grid">
                  <div>
                    <strong>حالة الرحلة</strong>
                    <p>{detailTrip.onBreak ? "في استراحة" : "نشطة"}</p>
                  </div>
                  <div>
                    <strong>بدء الرحلة</strong>
                    <p>{formatDateTime(detailTrip.startedAt)}</p>
                  </div>
                  <div>
                    <strong>بداية الاستراحة الحالية</strong>
                    <p>{formatDateTime(detailTrip.breakStartedAt)}</p>
                  </div>
                  <div>
                    <strong>آخر انتهاء استراحة</strong>
                    <p>{formatDateTime(detailTrip.breakEndedAt)}</p>
                  </div>
                </div>

                <h4>سجل الاستراحات</h4>
                {(detailTrip.breakHistory ?? []).length === 0 ? (
                  <p className="muted">لا توجد استراحات مسجّلة في هذه الرحلة.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>البداية</th>
                        <th>النهاية</th>
                        <th>المدة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailTrip.breakHistory ?? []).map((entry, index) => (
                        <tr key={`${entry.startedAt}-${index}`}>
                          <td>{formatDateTime(entry.startedAt)}</td>
                          <td>{formatDateTime(entry.endedAt)}</td>
                          <td>
                            {formatDurationMinutes(entry.startedAt, entry.endedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
