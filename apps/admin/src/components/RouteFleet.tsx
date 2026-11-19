"use client";

import { useCallback, useEffect, useState } from "react";
import type { Bus, Driver, Route } from "@tardadi/shared";
import { api } from "@/lib/api";
import { adminFetch } from "@/lib/adminFetch";
import { getUserErrorMessage } from "@/lib/errorMessage";

type Props = {
  route: Route;
};

export default function RouteFleet({ route }: Props) {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [plateNo, setPlateNo] = useState("");
  const [label, setLabel] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { name: string; phone: string; replace: boolean }>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    const [busRows, driverRows] = await Promise.all([
      api.getBuses() as Promise<Bus[]>,
      api.getDrivers() as Promise<Driver[]>,
    ]);
    setBuses(
      busRows.filter(
        (bus) => bus.businessId === route.businessId && bus.routeId === route.routeId
      )
    );
    setDrivers(driverRows.filter((driver) => driver.businessId === route.businessId));
  }, [route.businessId, route.routeId]);

  useEffect(() => {
    void load().catch((e) => setError(getUserErrorMessage(e)));
  }, [load]);

  function driverFor(busId: string) {
    return drivers.find(
      (driver) => driver.assignedBusId === busId && driver.status === "active"
    );
  }

  async function addBus(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      await adminFetch("/api/buses", {
        method: "POST",
        body: JSON.stringify({ plateNo, label, routeId: route.routeId }),
      });
      setPlateNo("");
      setLabel("");
      setSuccess("تمت إضافة الباص على هذا الخط.");
      await load();
    } catch (e) {
      setError(getUserErrorMessage(e));
    }
  }

  async function saveDriver(bus: Bus) {
    const draft = drafts[bus.busId] ?? { name: "", phone: "", replace: false };
    setError("");
    setSuccess("");
    try {
      await adminFetch("/api/drivers", {
        method: "POST",
        body: JSON.stringify({
          name: draft.name,
          phone: draft.phone,
          busId: bus.busId,
          replace: draft.replace,
        }),
      });
      setDrafts((current) => ({
        ...current,
        [bus.busId]: { name: "", phone: "", replace: false },
      }));
      setSuccess("تم تعيين السائق. الخط مأخوذ من الباص.");
      await load();
    } catch (e) {
      setError(getUserErrorMessage(e));
    }
  }

  return (
    <div className="stack">
      <h4>باصات الخط</h4>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      {buses.length === 0 && <p className="muted">لا يوجد باص على هذا الخط.</p>}
      {buses.map((bus) => {
        const driver = driverFor(bus.busId);
        const draft = drafts[bus.busId] ?? {
          name: "",
          phone: "",
          replace: false,
        };
        return (
          <div key={bus.busId} className="card">
            <strong>
              {bus.label} · {bus.plateNo}
            </strong>
            <p className="muted">
              {driver ? `السائق: ${driver.name} · ${driver.phone}` : "لا يوجد سائق"}
            </p>
            {(!driver || draft.replace) && (
              <div className="stack">
                <input
                  placeholder="اسم السائق"
                  value={draft.name}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [bus.busId]: { ...draft, name: event.target.value },
                    }))
                  }
                />
                <input
                  dir="ltr"
                  placeholder="05XXXXXXXX"
                  value={draft.phone}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [bus.busId]: { ...draft, phone: event.target.value },
                    }))
                  }
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => void saveDriver(bus)}
                >
                  {draft.replace ? "تغيير السائق" : "تعيين السائق"}
                </button>
              </div>
            )}
            {driver && !draft.replace && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setDrafts((current) => ({
                    ...current,
                    [bus.busId]: { name: "", phone: "", replace: true },
                  }))
                }
              >
                تغيير السائق
              </button>
            )}
          </div>
        );
      })}
      <form className="stack" onSubmit={addBus}>
        <h4>إضافة باص على هذا الخط</h4>
        <input
          placeholder="اسم الباص"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          required
        />
        <input
          placeholder="رقم اللوحة"
          value={plateNo}
          onChange={(event) => setPlateNo(event.target.value)}
          required
        />
        <button className="btn" type="submit">
          حفظ الباص
        </button>
      </form>
    </div>
  );
}
