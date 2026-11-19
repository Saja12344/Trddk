"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Bus, Driver, Route, Trip, TripBreakLog } from "@tardadi/shared";
import { api } from "@/lib/api";
import MapView from "@/components/MapView";
import { geoPointToLatLng, type MapMarker } from "@/lib/mapUtils";
import { getUserErrorMessage } from "@/lib/errorMessage";
import { liveTripState } from "@/lib/liveTrip";
import SelectInput from "@/components/SelectInput";

type Tab = "now" | "log";
type PeriodFilter = "7d" | "30d" | "all";

function OperationsScreen() {
  const search = useSearchParams();
  const tab: Tab = search.get("tab") === "log" ? "log" : "now";
  const [trips, setTrips] = useState<Trip[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [error, setError] = useState("");
  const [driverFilter, setDriverFilter] = useState("all");
  const [routeFilter, setRouteFilter] = useState("all");
  const [period, setPeriod] = useState<PeriodFilter>("7d");

  useEffect(() => {
    let cancel = false;
    async function load() {
      try {
        const [tripData, busData, driverData, routeData] = await Promise.all([
          api.getTrips() as Promise<Trip[]>,
          api.getBuses() as Promise<Bus[]>,
          api.getDrivers() as Promise<Driver[]>,
          api.getRoutes() as Promise<Route[]>,
        ]);
        if (cancel) return;
        setTrips(tripData);
        setBuses(busData);
        setDrivers(driverData);
        setRoutes(routeData);
        setError("");
      } catch (e) {
        if (!cancel) setError(getUserErrorMessage(e));
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, []);

  const busById = useMemo(() => new Map(buses.map((bus) => [bus.busId, bus])), [buses]);
  const routeById = useMemo(() => new Map(routes.map((route) => [route.routeId, route])), [routes]);

  const ranked = useMemo(() => {
    const rank = { driving: 0, break: 1, idle: 2 };
    return [...drivers].sort((a, b) => {
      const tripA = trips.find((trip) => trip.driverId === a.driverId && trip.tripStatus === "active");
      const tripB = trips.find((trip) => trip.driverId === b.driverId && trip.tripStatus === "active");
      const stateA = liveTripState(tripA, tripA ? busById.get(tripA.busId) : null);
      const stateB = liveTripState(tripB, tripB ? busById.get(tripB.busId) : null);
      return rank[stateA] - rank[stateB] || a.name.localeCompare(b.name, "ar");
    });
  }, [busById, drivers, trips]);

  const markers: MapMarker[] = useMemo(() => {
    const next: MapMarker[] = [];
    for (const trip of trips) {
      if (liveTripState(trip, busById.get(trip.busId)) !== "driving") continue;
      const bus = busById.get(trip.busId);
      if (!bus?.currentLocation) continue;
      const driver = drivers.find((item) => item.driverId === trip.driverId);
      next.push({
        id: trip.tripId,
        position: geoPointToLatLng(bus.currentLocation),
        label: driver?.name ?? bus.label,
        kind: "bus",
      });
    }
    return next;
  }, [busById, drivers, trips]);

  const logTrips = useMemo(() => {
    const start = periodStart(period);
    return trips
      .filter((trip) => {
        if (driverFilter !== "all" && trip.driverId !== driverFilter) return false;
        if (routeFilter !== "all" && trip.routeId !== routeFilter) return false;
        if (start != null) {
          const anchor = trip.startedAt ?? trip.createdAt;
          if (!anchor || new Date(anchor).getTime() < start) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.startedAt ?? b.createdAt ?? 0).getTime() -
          new Date(a.startedAt ?? a.createdAt ?? 0).getTime()
      );
  }, [driverFilter, period, routeFilter, trips]);

  return (
    <>
      <div className="page-header">
        <h1>التشغيل</h1>
        <p>الآن يعرض كل السائقين والخريطة. السجل صف لكل رحلة، بلا تعديل على الرحلة.</p>
      </div>
      <div className="tabs">
        <a className={`tab ${tab === "now" ? "active" : ""}`} href="/operations?tab=now">
          الآن
        </a>
        <a className={`tab ${tab === "log" ? "active" : ""}`} href="/operations?tab=log">
          السجل
        </a>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {tab === "now" ? (
        <>
          <div className="card map-card">
            <h3>الخريطة ({markers.length})</h3>
            <MapView markers={markers} height={420} />
          </div>
          <div className="card table-wrap">
            <h3>السائقون ({ranked.length})</h3>
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الجوال</th>
                  <th>الخط</th>
                  <th>الباص</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((driver) => {
                  const trip = trips.find(
                    (item) => item.driverId === driver.driverId && item.tripStatus === "active"
                  );
                  const state = liveTripState(trip, trip ? busById.get(trip.busId) : null);
                  const routeName =
                    routes.find((route) => route.routeId === driver.assignedRouteId)?.name ?? "—";
                  const busLabel =
                    buses.find((bus) => bus.busId === driver.assignedBusId)?.label ?? "—";
                  return (
                    <tr key={driver.driverId}>
                      <td>{driver.name}</td>
                      <td dir="ltr">{driver.phone}</td>
                      <td>{routeName}</td>
                      <td>{busLabel}</td>
                      <td>{stateLabel(state)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card table-wrap">
          <div className="filters-row">
            <div className="field">
              <label>السائق</label>
              <SelectInput value={driverFilter} onChange={(event) => setDriverFilter(event.target.value)}>
                <option value="all">الكل</option>
                {drivers.map((driver) => (
                  <option key={driver.driverId} value={driver.driverId}>
                    {driver.name}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div className="field">
              <label>الخط</label>
              <SelectInput value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)}>
                <option value="all">الكل</option>
                {routes.map((route) => (
                  <option key={route.routeId} value={route.routeId}>
                    {route.name}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div className="field">
              <label>الفترة</label>
              <SelectInput
                value={period}
                onChange={(event) => setPeriod(event.target.value as PeriodFilter)}
              >
                <option value="7d">آخر 7 أيام</option>
                <option value="30d">آخر 30 يوم</option>
                <option value="all">كل الوقت</option>
              </SelectInput>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>السائق</th>
                <th>الخط</th>
                <th>الباص</th>
                <th>من</th>
                <th>إلى</th>
                <th>المدة</th>
                <th>الاستراحات</th>
              </tr>
            </thead>
            <tbody>
              {logTrips.map((trip) => {
                const driver = drivers.find((item) => item.driverId === trip.driverId);
                const breaks = trip.breakHistory ?? [];
                return (
                  <tr key={trip.tripId}>
                    <td>{driver?.name ?? "—"}</td>
                    <td>{routeById.get(trip.routeId)?.name ?? "—"}</td>
                    <td>{busById.get(trip.busId)?.label ?? "—"}</td>
                    <td>{formatWhen(trip.startedAt)}</td>
                    <td>{formatWhen(trip.endedAt)}</td>
                    <td>{formatDuration(trip.startedAt, trip.endedAt)}</td>
                    <td>{formatBreaks(breaks)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function stateLabel(state: "driving" | "break" | "idle") {
  if (state === "driving") return <span className="chip chip-success">في رحلة</span>;
  if (state === "break") return <span className="chip chip-warn">في استراحة</span>;
  return <span className="chip">غير نشط</span>;
}

function periodStart(period: PeriodFilter): number | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : 30;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return "—";
  const minutes = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  if (minutes < 60) return `${minutes} د`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours} س ${rem} د` : `${hours} س`;
}

function formatBreaks(breaks: TripBreakLog[]) {
  if (breaks.length === 0) return "—";
  return String(breaks.length);
}

export default function OperationsPage() {
  return (
    <Suspense fallback={<p className="muted">جاري التحميل…</p>}>
      <OperationsScreen />
    </Suspense>
  );
}
