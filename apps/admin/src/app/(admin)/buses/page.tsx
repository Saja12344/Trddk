"use client";

import { useEffect, useState } from "react";
import type { Bus } from "@tardadi/shared";
import { api } from "@/lib/api";
import { getUserErrorMessage } from "@/lib/errorMessage";
import BusinessBadge from "@/components/BusinessBadge";
import { useBusinessMap, useShowBusinessColumn } from "@/hooks/useBusinessMap";

export default function BusesPage() {
  const businessMap = useBusinessMap();
  const showBusiness = useShowBusinessColumn();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = (await api.getBuses()) as Bus[];
      setBuses(data);
      setError("");
    } catch (e) {
      setError(getUserErrorMessage(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>الباصات</h1>
        <p>الباصات تُضاف من داخل الخط. هذه الصفحة للعرض.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      <div className="grid-2">
        <div className="card">
          <h3>إضافة الباص</h3>
          <p className="muted">
            الباص يتبع خطاً واحداً. أضفه من صفحة الخط، ويأخذ السائق خطه من الباص.
          </p>
        </div>

        <div className="card table-wrap">
          <h3>الباصات ({buses.length})</h3>
          <table>
            <thead>
              <tr>
                {showBusiness && <th>الشركة</th>}
                <th>الاسم</th>
                <th>اللوحة</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {buses.map((bus) => (
                <tr key={bus.busId}>
                  {showBusiness && (
                    <td>
                      <BusinessBadge
                        name={businessMap[bus.businessId] || bus.businessId}
                      />
                    </td>
                  )}
                  <td>{bus.label}</td>
                  <td>{bus.plateNo}</td>
                  <td>{bus.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
