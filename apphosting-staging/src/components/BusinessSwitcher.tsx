"use client";

import { useCallback, useEffect, useState } from "react";
import type { BusinessListItem } from "@tardadi/shared";
import SelectInput from "./SelectInput";
import { useAuth } from "./AuthProvider";
import { isSuperAdmin } from "@/lib/auth.constants";
import { adminFetch } from "@/lib/adminFetch";

export default function BusinessSwitcher() {
  const { user, businessContextId, setBusinessContext, clearBusinessContext } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBusinesses = useCallback(async () => {
    if (!isSuperAdmin(user)) return;
    setLoading(true);
    try {
      const list = await adminFetch<BusinessListItem[]>("/api/businesses");
      setBusinesses(Array.isArray(list) ? list : []);
    } catch {
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadBusinesses();
  }, [loadBusinesses]);

  useEffect(() => {
    function onFocus() {
      void loadBusinesses();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadBusinesses]);

  if (!isSuperAdmin(user)) return null;

  return (
    <div className="business-switcher">
      <span className="business-switcher-label">الشركة النشطة</span>
      <SelectInput
        value={businessContextId || ""}
        disabled={loading}
        onChange={(e) => {
          const next = e.target.value;
          if (next) void setBusinessContext(next);
          else void clearBusinessContext();
        }}
      >
        <option value="">
          {loading
            ? "جاري التحميل..."
            : businesses.length === 0
              ? "لا توجد شركات"
              : "بدون شركة (عام)"}
        </option>
        {(businesses ?? []).map((b) => (
          <option key={b.businessId} value={b.businessId}>
            {b.name}
          </option>
        ))}
      </SelectInput>
    </div>
  );
}
