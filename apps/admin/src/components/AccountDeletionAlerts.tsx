"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminAccountNotification } from "@tardadi/shared";
import { adminFetch } from "@/lib/adminFetch";
import { isSuperAdmin } from "@/lib/auth.constants";
import { useAuth } from "./AuthProvider";

export default function AccountDeletionAlerts() {
  const { user, businessContextId } = useAuth();
  const [items, setItems] = useState<AdminAccountNotification[]>([]);
  const [open, setOpen] = useState(false);
  const businessReady =
    Boolean(user) && (!isSuperAdmin(user) || Boolean(businessContextId));

  const load = useCallback(async () => {
    if (!businessReady) {
      setItems([]);
      return;
    }
    try {
      const data = await adminFetch<AdminAccountNotification[]>(
        "/api/admin-notifications"
      );
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    }
  }, [businessReady, businessContextId]);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = items.filter((item) => !item.read);
  if (!businessReady || items.length === 0) return null;

  async function markRead(id: string) {
    await adminFetch(`/api/admin-notifications/${id}/read`, { method: "POST" });
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  }

  return (
    <div className="account-alerts">
      <button
        type="button"
        className="account-alerts-bell"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>الحسابات المحذوفة</span>
        {unread.length > 0 ? (
          <span className="account-alerts-badge">{unread.length}</span>
        ) : null}
      </button>
      {open ? (
        <ul className="account-alerts-list">
          {items.map((item) => {
            const date = Number.isNaN(Date.parse(item.createdAt))
              ? item.createdAt
              : new Date(item.createdAt).toLocaleDateString("ar-SA");
            return (
              <li key={item.id}>
                <p>
                  {item.displayName} حذف حسابه · {date}
                </p>
                {!item.read ? (
                  <button type="button" onClick={() => void markRead(item.id)}>
                    تمت القراءة
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
