"use client";

import { useEffect, useMemo, useState } from "react";
import type { Bus, Driver, Route, Trip, TripBreakLog } from "@tardadi/shared";
import { api } from "@/lib/api";
import MapView from "@/components/MapView";
import { geoPointToLatLng, type MapMarker } from "@/lib/mapUtils";
import { getUserErrorMessage } from "@/lib/errorMessage";
import SelectInput from "@/components/SelectInput";

type PeriodFilter = "7d" | "30d" | "all";
type BreakFilter = "all" | "on_break" | "had_break" | "no_break";

type DriverRow = {
  driver: Driver;
  activeTrip: Trip | null;
  tripsInPeriod: Trip[];
  status: "active" | "on_break" | "inactive";
};

const MAIN_PERIOD: PeriodFilter = "7d";

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [error, setError] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [detailPeriod, setDetailPeriod] = useState<PeriodFilter>("7d");
  const [detailBreakFilter, setDetailBreakFilter] =
    useState<BreakFilter>("all");

  async function load() {
    try {
      const [tripData, busData, driverData, routeData] = await Promise.all([
        api.getTrips() as Promise<Trip[]>,
        api.getBuses() as Promise<Bus[]>,
        api.getDrivers() as Promise<Driver[]>,
        api.getRoutes() as Promise<Route[]>,
      ]);
      setTrips(tripData);
      setBuses(busData);
      setDrivers(driverData);
      setRoutes(routeData);
      setError("");
    } catch (e) {
      setError(getUserErrorMessage(e));
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, []);

  const busById = useMemo(
    () => new Map(buses.map((bus) => [bus.busId, bus])),
    [buses]
  );

  const driverById = useMemo(
    () => new Map(drivers.map((driver) => [driver.driverId, driver])),
    [drivers]
  );

  const routeById = useMemo(
    () => new Map(routes.map((route) => [route.routeId, route])),
    [routes]
  );

  const mainPeriodStart = useMemo(() => periodStartFor(MAIN_PERIOD), []);

  const tripsInMainPeriod = useMemo(() => {
    if (mainPeriodStart == null) return trips;
    return trips.filter((trip) => tripInPeriod(trip, mainPeriodStart));
  }, [trips, mainPeriodStart]);

  const driverRows = useMemo(() => {
    const tripsByDriver = new Map<string, Trip[]>();
    for (const trip of tripsInMainPeriod) {
      const list = tripsByDriver.get(trip.driverId) ?? [];
      list.push(trip);
      tripsByDriver.set(trip.driverId, list);
    }

    const activeByDriver = new Map<string, Trip>();
    for (const trip of trips.filter((t) => t.tripStatus === "active")) {
      activeByDriver.set(trip.driverId, trip);
    }

    const driverIds = new Set<string>([
      ...drivers.map((d) => d.driverId),
      ...tripsInMainPeriod.map((t) => t.driverId),
    ]);

    const rows: DriverRow[] = [];
    for (const driverId of driverIds) {
      const driver = driverById.get(driverId);
      if (!driver) continue;

      const activeTrip = activeByDriver.get(driverId) ?? null;
      const periodTrips = [...(tripsByDriver.get(driverId) ?? [])].sort(
        (a, b) =>
          new Date(b.startedAt ?? b.createdAt ?? 0).getTime() -
          new Date(a.startedAt ?? a.createdAt ?? 0).getTime()
      );

      if (periodTrips.length === 0 && !activeTrip) continue;

      let status: DriverRow["status"] = "inactive";
      if (activeTrip?.onBreak) status = "on_break";
      else if (activeTrip) status = "active";

      rows.push({
        driver,
        activeTrip,
        tripsInPeriod: periodTrips,
        status,
      });
    }

    rows.sort((a, b) => a.driver.name.localeCompare(b.driver.name, "ar"));
    return rows;
  }, [drivers, driverById, trips, tripsInMainPeriod]);

  const liveMarkers: MapMarker[] = useMemo(() => {
    const markers: MapMarker[] = [];
    for (const trip of trips.filter(
      (trip) => trip.tripStatus === "active" && !trip.onBreak
    )) {
      const bus = busById.get(trip.busId);
      if (!bus?.currentLocation) continue;
      const driver = driverById.get(trip.driverId);
      markers.push({
        id: trip.tripId,
        position: geoPointToLatLng(bus.currentLocation),
        label: driver?.name ?? `${bus.label} (${bus.plateNo})`,
        kind: "bus",
      });
    }
    return markers;
  }, [trips, busById, driverById]);

  const selectedRow = selectedDriverId
    ? driverRows.find((row) => row.driver.driverId === selectedDriverId) ??
      null
    : null;

  const detailPeriodStart = useMemo(
    () => periodStartFor(detailPeriod),
    [detailPeriod]
  );

  const detailTrips = useMemo(() => {
    if (!selectedRow) return [];

    const merged = selectedRow.activeTrip
      ? [
          selectedRow.activeTrip,
          ...trips.filter(
            (t) =>
              t.driverId === selectedRow.driver.driverId &&
              t.tripId !== selectedRow.activeTrip?.tripId
          ),
        ]
      : trips.filter((t) => t.driverId === selectedRow.driver.driverId);

    const unique = [...new Map(merged.map((t) => [t.tripId, t])).values()];

    return unique
      .filter((trip) => {
        if (detailPeriodStart != null && !tripInPeriod(trip, detailPeriodStart)) {
          return false;
        }
        if (detailBreakFilter === "all") return true;
        const breaks = collectBreakLogs(trip);
        if (detailBreakFilter === "on_break") return !!trip.onBreak;
        if (detailBreakFilter === "had_break") return breaks.length > 0;
        if (detailBreakFilter === "no_break") return breaks.length === 0;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.startedAt ?? b.createdAt ?? 0).getTime() -
          new Date(a.startedAt ?? a.createdAt ?? 0).getTime()
      );
  }, [selectedRow, trips, detailPeriodStart, detailBreakFilter]);

  function openDriverDetail(driverId: string) {
    setSelectedDriverId(driverId);
    setDetailPeriod("7d");
    setDetailBreakFilter("all");
  }

  return (
    <>
      <div className="page-header">
        <h1>سجل الرحلات</h1>
        <p>
          قائمة مختصرة بالسائقين — اضغط على الاسم لعرض تفاصيل الرحلات والاستراحات.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card map-card">
        <h3>خريطة الرحلات المباشرة ({liveMarkers.length} باص على الخريطة)</h3>
        {liveMarkers.length === 0 && (
          <p className="map-hint">
            لا توجد مواقع GPS حالياً — تظهر عندما يبدأ السائق الرحلة.
          </p>
        )}
        <MapView markers={liveMarkers} height={420} />
      </div>

      <div className="card table-wrap">
        <h3>السائقون ({driverRows.length})</h3>
        <table>
          <thead>
            <tr>
              <th>السائق</th>
              <th>الحالة</th>
              <th>الخط</th>
              <th>رحلات (7 أيام)</th>
              <th>آخر نشاط</th>
            </tr>
          </thead>
          <tbody>
            {driverRows.length === 0 ? (
              <tr>
                <td colSpan={5}>لا يوجد سائقون</td>
              </tr>
            ) : (
              driverRows.map((row) => {
                const route = row.activeTrip
                  ? routeById.get(row.activeTrip.routeId)
                  : row.tripsInPeriod[0]
                    ? routeById.get(row.tripsInPeriod[0].routeId)
                    : null;
                const latest = row.tripsInPeriod[0] ?? row.activeTrip;

                return (
                  <tr key={row.driver.driverId}>
                    <td>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => openDriverDetail(row.driver.driverId)}
                      >
                        {row.driver.name}
                      </button>
                    </td>
                    <td>{renderDriverStatus(row.status)}</td>
                    <td>
                      {route ? `${route.name} (${route.code})` : "—"}
                    </td>
                    <td>{row.tripsInPeriod.length}</td>
                    <td>{formatDateTime(latest?.startedAt ?? latest?.endedAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedRow && (
        <div className="modal-backdrop" onClick={() => setSelectedDriverId(null)}>
          <div
            className="card modal-card modal-card-wide"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{selectedRow.driver.name}</h3>
              <button
                type="button"
                className="modal-close-btn"
                aria-label="إغلاق"
                onClick={() => setSelectedDriverId(null)}
              >
                ×
              </button>
            </div>

            <p className="muted" dir="ltr">
              {selectedRow.driver.phone}
            </p>

            <div className="detail-grid">
              <div>
                <strong>الحالة الآن</strong>
                <p>{renderDriverStatusLabel(selectedRow.status)}</p>
              </div>
              <div>
                <strong>عدد الرحلات بالفترة</strong>
                <p>{detailTrips.length}</p>
              </div>
            </div>

            <div className="filters-row modal-filters">
              <div className="field">
                <label>الفترة</label>
                <SelectInput
                  value={detailPeriod}
                  onChange={(e) =>
                    setDetailPeriod(e.target.value as PeriodFilter)
                  }
                >
                  <option value="7d">آخر 7 أيام</option>
                  <option value="30d">آخر 30 يوم</option>
                  <option value="all">كل الوقت</option>
                </SelectInput>
              </div>
              <div className="field">
                <label>الاستراحات</label>
                <SelectInput
                  value={detailBreakFilter}
                  onChange={(e) =>
                    setDetailBreakFilter(e.target.value as BreakFilter)
                  }
                >
                  <option value="all">الكل</option>
                  <option value="on_break">في استراحة الآن</option>
                  <option value="had_break">أخذ استراحة</option>
                  <option value="no_break">بدون استراحات</option>
                </SelectInput>
              </div>
            </div>

            <h4>تفاصيل الرحلات</h4>
            {detailTrips.length === 0 ? (
              <p className="muted">لا توجد رحلات في هذه الفترة.</p>
            ) : (
              <div className="trip-detail-list">
                {detailTrips.map((trip) => {
                  const route = routeById.get(trip.routeId);
                  const bus = busById.get(trip.busId);
                  const breaks = collectBreakLogs(trip);

                  return (
                    <div key={trip.tripId} className="trip-detail-card">
                      <div className="trip-detail-head">
                        <span className={`status-pill status-${trip.tripStatus}`}>
                          {formatTripStatus(trip.tripStatus)}
                          {trip.onBreak ? " · استراحة" : ""}
                        </span>
                      </div>
                      <p>
                        {route?.name ?? shortId(trip.routeId)} ·{" "}
                        {bus ? `${bus.label} (${bus.plateNo})` : shortId(trip.busId)}
                      </p>
                      <div className="detail-grid">
                        <div>
                          <strong>من</strong>
                          <p>{formatDateTime(trip.startedAt)}</p>
                        </div>
                        <div>
                          <strong>إلى</strong>
                          <p>{formatDateTime(trip.endedAt)}</p>
                        </div>
                        <div>
                          <strong>مدة الرحلة</strong>
                          <p>
                            {formatDurationMinutes(trip.startedAt, trip.endedAt)}
                          </p>
                        </div>
                        <div>
                          <strong>الاستراحات</strong>
                          <p>{formatBreaksSummary(breaks)}</p>
                        </div>
                      </div>
                      {breaks.length > 0 && (
                        <table>
                          <thead>
                            <tr>
                              <th>بداية الاستراحة</th>
                              <th>نهاية الاستراحة</th>
                              <th>المدة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {breaks.map((entry, index) => (
                              <tr key={`${entry.startedAt}-${index}`}>
                                <td>{formatDateTime(entry.startedAt)}</td>
                                <td>
                                  {entry.ongoing
                                    ? "مستمرة"
                                    : formatDateTime(entry.endedAt)}
                                </td>
                                <td>
                                  {formatDurationMinutes(
                                    entry.startedAt,
                                    entry.ongoing ? null : entry.endedAt
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function periodStartFor(period: PeriodFilter): number | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : 30;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function tripInPeriod(trip: Trip, periodStart: number): boolean {
  const anchor = trip.startedAt ?? trip.createdAt;
  if (!anchor) return false;
  return new Date(anchor).getTime() >= periodStart;
}

function collectBreakLogs(
  trip: Trip
): Array<TripBreakLog & { ongoing?: boolean }> {
  const logs: Array<TripBreakLog & { ongoing?: boolean }> = [
    ...(trip.breakHistory ?? []),
  ];
  if (trip.onBreak && trip.breakStartedAt) {
    logs.unshift({
      startedAt: trip.breakStartedAt,
      endedAt: "",
      ongoing: true,
    });
  }
  return logs;
}

function formatBreaksSummary(
  breaks: Array<TripBreakLog & { ongoing?: boolean }>
): string {
  if (breaks.length === 0) return "لا توجد استراحات";
  const duration = formatTotalBreakDuration(breaks);
  if (duration === "—") {
    return breaks.length === 1
      ? "استراحة واحدة · مستمرة"
      : `${breaks.length} استراحات · مستمرة`;
  }
  if (breaks.length === 1) return `استراحة واحدة · ${duration}`;
  return `${breaks.length} استراحات · ${duration}`;
}

function formatTotalBreakDuration(
  breaks: Array<TripBreakLog & { ongoing?: boolean }>
): string {
  if (breaks.length === 0) return "—";
  const now = Date.now();
  let totalMinutes = 0;
  for (const entry of breaks) {
    if (!entry.startedAt) continue;
    const start = new Date(entry.startedAt).getTime();
    const end = entry.ongoing
      ? now
      : entry.endedAt
        ? new Date(entry.endedAt).getTime()
        : start;
    if (Number.isNaN(start) || end <= start) continue;
    totalMinutes += Math.max(1, Math.round((end - start) / 60000));
  }
  if (totalMinutes < 60) return `${totalMinutes} د`;
  const hours = Math.floor(totalMinutes / 60);
  const rem = totalMinutes % 60;
  return rem > 0 ? `${hours} س ${rem} د` : `${hours} س`;
}

function renderDriverStatus(status: DriverRow["status"]) {
  if (status === "on_break") {
    return <span className="chip chip-warn">في استراحة</span>;
  }
  if (status === "active") {
    return <span className="chip chip-success">نشط</span>;
  }
  return <span className="chip">غير نشط</span>;
}

function renderDriverStatusLabel(status: DriverRow["status"]) {
  if (status === "on_break") return "في استراحة";
  if (status === "active") return "نشط";
  return "غير نشط";
}

function shortId(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function formatDateTime(value?: string | null): string {
  if (!value || value === "—") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDurationMinutes(
  start?: string | null,
  end?: string | null
): string {
  if (!start) return "—";
  if (!end || end === "—") return "مستمرة";
  const minutes = Math.max(
    1,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  );
  if (minutes < 60) return `${minutes} د`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours} س ${rem} د` : `${hours} س`;
}

function formatTripStatus(status: Trip["tripStatus"]): string {
  if (status === "active") return "نشطة";
  if (status === "ended") return "منتهية";
  return "مجدولة";
}
