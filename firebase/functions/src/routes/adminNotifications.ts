import { Router } from "express";
import { requirePermission } from "../auth/middleware";
import { resolveBusinessId } from "../auth/scope";
import { businessRef } from "../business/helpers";
import { db } from "../firebase";
import { ADMIN_NOTIFICATIONS } from "../services/accountDeletion";
import { fail, ok, paramId } from "../utils";

const router = Router();

router.get("/", requirePermission("drivers:read"), async (req, res) => {
  try {
    const businessId = resolveBusinessId(req, req.adminAuth);
    if (!businessId) {
      fail(res, "حدّد الشركة أولاً.");
      return;
    }
    const snap = await businessRef(db, businessId)
      .collection(ADMIN_NOTIFICATIONS)
      .get();
    const items = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as {
        id: string;
        type?: string;
        createdAt?: string;
      })
      .filter((item) => item.type === "account_deleted")
      .sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
      );
    ok(res, items);
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

router.post("/:id/read", requirePermission("drivers:read"), async (req, res) => {
  try {
    const businessId = resolveBusinessId(req, req.adminAuth);
    if (!businessId) {
      fail(res, "حدّد الشركة أولاً.");
      return;
    }
    const id = paramId(req.params.id);
    const ref = businessRef(db, businessId)
      .collection(ADMIN_NOTIFICATIONS)
      .doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      fail(res, "Notification not found", 404);
      return;
    }
    await ref.set({ read: true }, { merge: true });
    ok(res, { id, read: true });
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

export default router;
