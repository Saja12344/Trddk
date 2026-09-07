"use client";

import { useEffect, useState } from "react";
import type { Bus, Driver, Route, Trip } from "@tardadi/shared";
import { api } from "@/lib/api";
import { adminFetch } from "@/lib/adminFetch";
import { getUserErrorMessage } from "@/lib/errorMessage";
import SelectInput from "@/components/SelectInput";
import BusinessBadge from "@/components/BusinessBadge";
import { useBusinessMap, useShowBusinessColumn } from "@/hooks/useBusinessMap";

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
  const businessMap = useBusinessMap();
  const showBusiness = useShowBusinessColumn();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [assignedRouteId, setAssignedRouteId] = useState("");
  const [assignedBusId, setAssignedBusId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
  }

  async function createDriver(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await adminFetch("/api/drivers", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone,
          assignedRouteId,
          assignedBusId,
        }),
      });
      setName("");
      setPhone("");
      setAssignedRouteId("");
      setAssignedBusId("");
      setSuccess("تمت إضافة السائق. يقدر يسجّل دخوله برقم جواله في التطبيق.");
      await load();
    } catch (e) {
      setError(getUserErrorMessage(e));
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedTrip = selectedDriver
    ? activeTrips.find((trip) => trip.driverId === selectedDriver.driverId)
    : null;

  return (
    <>
      <div className="page-header">
        <h1>السائقين</h1>
        <p>أضف اسم السائق ورقم جواله. اضغط على السائق لعرض تفاصيل الاستراحة والرحلة.</p>
      </div>

      <div className="grid-2">
        <form className="card" onSubmit={createDriver}>
          <h3>إضافة سائق</h3>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="field">
            <label>اسم السائق</label>
            <input
              placeholder="مثال: أحمد علي"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>رقم الجوال</label>
            <input
              placeholder="05xxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>الخط المسموح</label>
            <SelectInput
              value={assignedRouteId}
              onChange={(e) => setAssignedRouteId(e.target.value)}
              required
            >
              <option value="">اختر الخط</option>
              {routes.map((route) => (
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
              {buses.map((bus) => (
                <option key={bus.busId} value={bus.busId}>
                  {showBusiness && businessMap[bus.businessId]
                    ? `${businessMap[bus.businessId]} · `
                    : ""}
                  {bus.label}
                </option>
              ))}
            </SelectInput>
          </div>

          {buses.length === 0 && (
            <div className="alert alert-error">
              لا توجد باصات. أضف باصاً أولاً من صفحة الباصات.
            </div>
          )}

          <button className="btn" type="submit">
            حفظ السائق
          </button>
        </form>

        <div className="card table-wrap">
          <h3>السائقين ({drivers.length})</h3>
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الجوال</th>
                {showBusiness && <th>الشركة</th>}
                <th>الخط</th>
                <th>الباص</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => {
                const routeName =
                  routes.find((r) => r.routeId === driver.assignedRouteId)?.name ||
                  "—";
                const busLabel =
                  buses.find((b) => b.busId === driver.assignedBusId)?.label ||
                  "—";
                const businessName =
                  businessMap[driver.businessId] || driver.businessId || "—";
                const trip = activeTrips.find(
                  (item) => item.driverId === driver.driverId
                );
                const onBreak = trip?.onBreak === true;

                return (
                  <tr
                    key={driver.driverId}
                    className="clickable-row"
                    onClick={() => setSelectedDriver(driver)}
                  >
                    <td>{driver.name}</td>
                    <td dir="ltr">{driver.phone}</td>
                    {showBusiness && (
                      <td>
                        <BusinessBadge name={businessName} />
                      </td>
                    )}
                    <td>
                      <span className="chip chip-route">{routeName}</span>
                    </td>
                    <td>{busLabel}</td>
                    <td>
                      {!trip ? (
                        <span className="chip">غير نشط</span>
                      ) : onBreak ? (
                        <span className="chip chip-warn">في استراحة</span>
                      ) : (
                        <span className="chip chip-success">في رحلة</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedDriver && (
        <div className="modal-backdrop" onClick={() => setSelectedDriver(null)}>
          <div
            className="card modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{selectedDriver.name}</h3>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelectedDriver(null)}
              >
                إغلاق
              </button>
            </div>

            <p dir="ltr">{selectedDriver.phone}</p>

            {!selectedTrip ? (
              <div className="alert">لا توجد رحلة نشطة لهذا السائق.</div>
            ) : (
              <>
                <div className="detail-grid">
                  <div>
                    <strong>حالة الرحلة</strong>
                    <p>
                      {selectedTrip.onBreak ? "في استراحة" : "نشطة"}
                    </p>
                  </div>
                  <div>
                    <strong>بدء الرحلة</strong>
                    <p>{formatDateTime(selectedTrip.startedAt)}</p>
                  </div>
                  <div>
                    <strong>بداية الاستراحة الحالية</strong>
                    <p>{formatDateTime(selectedTrip.breakStartedAt)}</p>
                  </div>
                  <div>
                    <strong>آخر انتهاء استراحة</strong>
                    <p>{formatDateTime(selectedTrip.breakEndedAt)}</p>
                  </div>
                </div>

                <h4>سجل الاستراحات</h4>
                {(selectedTrip.breakHistory ?? []).length === 0 ? (
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
                      {(selectedTrip.breakHistory ?? []).map((entry, index) => (
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
