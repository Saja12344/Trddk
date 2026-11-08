import { Router } from "express";
import type { Query } from "firebase-admin/firestore";
import { COLLECTIONS, DEFAULT_REMINDER_MINUTES } from "@tardadi/shared";
import { db } from "../firebase";
import { HttpError, requirePermission } from "../auth/middleware";
import { reminderOwner, requestedBusinessId, scopedBusinessId } from "../auth/driverAccess";
import { requireReminderWriter } from "../auth/tripAuth";
import { requireBusinessId } from "../auth/scope";
import { businessRef } from "../business/helpers";
import { fail, ok, paramId } from "../utils";
import { rejectStoreReviewAccess } from "../services/passengerReview";

const router = Router();

router.use(rejectStoreReviewAccess);

router.get("/", requirePermission("trips:read"), async (req, res) => {
  try {
    const orgId = requireBusinessId(req, req.adminAuth);
    const userId = req.query.userId as string | undefined;

    let query: Query = businessRef(db, orgId).collection(COLLECTIONS.reminders);

    if (userId) {
      query = query.where("userId", "==", userId);
    }

    const snapshot = await query.where("status", "==", "active").get();
    const reminders = snapshot.docs.map((doc) => ({
      reminderId: doc.id,
      organizationId: orgId,
      ...doc.data(),
    }));

    ok(res, reminders);
  } catch (error) {
    fail(res, (error as Error).message, 500);
  }
});

router.post("/", requireReminderWriter, async (req, res) => {
  try {
    const passenger = req.passengerSession;
    const scoped = passenger
      ? scopedBusinessId(passenger.businessId, requestedBusinessId(req))
      : null;
    if (passenger && scoped && !scoped.ok) {
      fail(res, "لا يمكنك الوصول لبيانات شركة أخرى.", scoped.status);
      return;
    }
    const orgId = passenger
      ? passenger.businessId
      : requireBusinessId(req, req.adminAuth);
    const owner = passenger ? reminderOwner(passenger.userId, req.body?.userId) : null;
    if (owner && !owner.ok) {
      fail(res, "ليس لديك صلاحية لهذا الإجراء.", 403);
      return;
    }
    const userId = owner?.ok ? owner.userId : req.body?.userId;
    const {
      busId,
      routeId,
      stopId,
      fcmToken,
      notifyWhenMinutesAway = DEFAULT_REMINDER_MINUTES,
    } = req.body;

    if (!userId || !busId || !routeId || !stopId || !fcmToken) {
      fail(res, "userId, busId, routeId, stopId, and fcmToken are required");
      return;
    }

    const now = new Date().toISOString();
    const docRef = await businessRef(db, orgId)
      .collection(COLLECTIONS.reminders)
      .add({
        userId,
        busId,
        routeId,
        stopId,
        fcmToken,
        status: "active",
        notifyWhenMinutesAway,
        createdAt: now,
        updatedAt: now,
      });

    ok(
      res,
      {
        reminderId: docRef.id,
        organizationId: orgId,
        userId,
        busId,
        routeId,
        stopId,
        status: "active",
        notifyWhenMinutesAway,
      },
      201
    );
  } catch (error) {
    const err = error as HttpError;
    fail(res, err.message, err.status ?? 500);
  }
});

router.delete("/:reminderId", requireReminderWriter, async (req, res) => {
  try {
    const passenger = req.passengerSession;
    const scoped = passenger
      ? scopedBusinessId(passenger.businessId, requestedBusinessId(req))
      : null;
    if (passenger && scoped && !scoped.ok) {
      fail(res, "لا يمكنك الوصول لبيانات شركة أخرى.", scoped.status);
      return;
    }
    const orgId = passenger
      ? passenger.businessId
      : requireBusinessId(req, req.adminAuth);
    const reminderId = paramId(req.params.reminderId);
    const ref = businessRef(db, orgId)
      .collection(COLLECTIONS.reminders)
      .doc(reminderId);
    const existing = await ref.get();
    if (!existing.exists) {
      fail(res, "Trip not found", 404);
      return;
    }
    if (passenger && existing.data()?.userId !== passenger.userId) {
      fail(res, "ليس لديك صلاحية لهذا الإجراء.", 403);
      return;
    }

    await ref.update({
      status: "cancelled",
      updatedAt: new Date().toISOString(),
    });

    ok(res, { reminderId, status: "cancelled" });
  } catch (error) {
    const err = error as HttpError;
    fail(res, err.message, err.status ?? 500);
  }
});

export default router;
