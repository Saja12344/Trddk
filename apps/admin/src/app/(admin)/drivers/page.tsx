"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Bus, Driver, Route, Trip } from "@tardadi/shared";
import { api } from "@/lib/api";
import { getUserErrorMessage } from "@/lib/errorMessage";
import BusinessBadge from "@/components/BusinessBadge";
import { useBusinessMap, useShowBusinessColumn } from "@/hooks/useBusinessMap";
import { liveTripState } from "@/lib/liveTrip";

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
  const [error, setError] = useState("");

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

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedTrip = selectedDriver
    ? activeTrips.find((trip) => trip.driverId === selectedDriver.driverId)
    : null;
  const selectedBus = selectedTrip
    ? buses.find((bus) => bus.busId === selectedTrip.busId)
    : null;
  const selectedPresence = liveTripState(selectedTrip, selectedBus);

  return (
    <>
      <div className="page-header">
        <h1>السائقين</h1>
        <p>
          إضافة السائق وتعديل رقمه أو حذفه تتم من{" "}
          <Link href="/beneficiaries">صفحة المستفيدين</Link>. هذه الصفحة لمتابعة
          الرحلة والاستراحة.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

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
                const bus = buses.find((item) => item.busId === trip?.busId);
                const presence = liveTripState(trip, bus);

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
                      {presence === "break" ? (
                        <span className="chip chip-warn">في استراحة</span>
                      ) : presence === "driving" ? (
                        <span className="chip chip-success">في رحلة</span>
                      ) : (
                        <span className="chip">غير نشط</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

            {selectedPresence === "idle" || !selectedTrip ? (
              <div className="alert">لا توجد رحلة نشطة لهذا السائق.</div>
            ) : (
              <>
                <div className="detail-grid">
                  <div>
                    <strong>حالة الرحلة</strong>
                    <p>
                      {selectedPresence === "break" ? "في استراحة" : "في رحلة"}
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
