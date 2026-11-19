import { Router } from "express";
import type { Query } from "firebase-admin/firestore";
import { COLLECTIONS } from "@tardadi/shared";
import { db } from "../firebase";
import { optionalAdminWithPermission, requirePermission } from "../auth/middleware";
import { BUS_WRITE_FIELDS, pickAllowedFields } from "../auth/driverAccess";
import { resolveBusinessId, requireBusinessId, withBusinessId } from "../auth/scope";
import {
  listAccessibleBusinessIds,
  mapAcrossBusinesses,
} from "../business/access";
import { businessRef } from "../business/helpers";
import { fail, ok, paramId } from "../utils";
import { decideBusRouteMove } from "../services/driverAssignmentRules";
import { rejectStoreReviewAccess } from "../services/passengerReview";

const router = Router();

router.use(rejectStoreReviewAccess);

async function listBusesForBusiness(
  businessId: string,
  activeOnly: boolean
) {
  let query: Query = businessRef(db, businessId).collection(COLLECTIONS.buses);
  if (activeOnly) {
    query = query.where("status", "==", "active");
  }
  const snapshot = await query.get();
  return snapshot.docs.map((doc) =>
    withBusinessId(businessId, { busId: doc.id, ...doc.data() })
  );
}

router.get("/", optionalAdminWithPermission("buses:read"), async (req, res) => {
  try {
    const businessId = resolveBusinessId(req, req.adminAuth);
    const activeOnly = req.query.active === "true";
    const businessIds = await listAccessibleBusinessIds(
      db,
      req.adminAuth,
      businessId
    );
    const buses = await mapAcrossBusinesses(db, businessIds, (id) =>
      listBusesForBusiness(id, activeOnly)
    );
    ok(res, buses);
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

router.post("/", requirePermission("buses:write"), async (req, res) => {
  try {
    const businessId = requireBusinessId(req, req.adminAuth);
    const { plateNo, label, status = "active", routeId } = req.body;

    if (!plateNo || !label || !routeId) {
      fail(res, "أضف الباص من صفحة الخط: اللوحة والاسم والخط مطلوبة.");
      return;
    }

    const routeDoc = await businessRef(db, businessId)
      .collection(COLLECTIONS.routes)
      .doc(routeId)
      .get();
    if (!routeDoc.exists) {
      fail(res, "الخط غير موجود.", 404);
      return;
    }

    const now = new Date().toISOString();
    const docRef = await businessRef(db, businessId)
      .collection(COLLECTIONS.buses)
      .add({
        plateNo,
        label,
        status,
        routeId,
        currentTripId: null,
        currentLocation: null,
        lastSeenAt: null,
        createdAt: now,
        updatedAt: now,
      });

    ok(
      res,
      withBusinessId(businessId, {
        busId: docRef.id,
        plateNo,
        label,
        status,
        routeId,
      }),
      201
    );
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

router.put("/:busId", requirePermission("buses:write"), async (req, res) => {
  try {
    const businessId = requireBusinessId(req, req.adminAuth);
    const busId = paramId(req.params.busId);
    const updates = {
      ...pickAllowedFields(req.body ?? {}, BUS_WRITE_FIELDS),
      updatedAt: new Date().toISOString(),
    };

    await businessRef(db, businessId)
      .collection(COLLECTIONS.buses)
      .doc(busId)
      .update(updates);

    ok(res, withBusinessId(businessId, { busId, ...updates }));
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

router.post("/:busId/route", requirePermission("buses:write"), async (req, res) => {
  try {
    const businessId = requireBusinessId(req, req.adminAuth);
    const busId = paramId(req.params.busId);
    const routeId = String(req.body?.routeId ?? "");
    if (!routeId) {
      fail(res, "الخط مطلوب.");
      return;
    }
    const routeDoc = await businessRef(db, businessId)
      .collection(COLLECTIONS.routes)
      .doc(routeId)
      .get();
    if (!routeDoc.exists) {
      fail(res, "الخط غير موجود.", 404);
      return;
    }
    const activeTrip = await businessRef(db, businessId)
      .collection(COLLECTIONS.trips)
      .where("busId", "==", busId)
      .where("tripStatus", "==", "active")
      .limit(1)
      .get();
    const decision = decideBusRouteMove(!activeTrip.empty);
    if (!decision.ok) {
      fail(res, decision.message, 409);
      return;
    }
    const now = new Date().toISOString();
    await businessRef(db, businessId).collection(COLLECTIONS.buses).doc(busId).update({
      routeId,
      updatedAt: now,
    });
    const drivers = await businessRef(db, businessId).collection(COLLECTIONS.drivers).get();
    await Promise.all(
      drivers.docs
        .filter((doc) => doc.data().assignedBusId === busId)
        .map((doc) => doc.ref.set({ assignedRouteId: routeId, updatedAt: now }, { merge: true }))
    );
    ok(res, withBusinessId(businessId, { busId, routeId }));
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

router.delete("/:busId", requirePermission("buses:write"), async (req, res) => {
  try {
    const businessId = requireBusinessId(req, req.adminAuth);
    const busId = paramId(req.params.busId);

    const busRef = businessRef(db, businessId).collection(COLLECTIONS.buses).doc(busId);
    const drivers = await businessRef(db, businessId).collection(COLLECTIONS.drivers).get();
    const assigned = drivers.docs.some((doc) => doc.data().assignedBusId === busId);
    const activeTrip = await businessRef(db, businessId)
      .collection(COLLECTIONS.trips)
      .where("busId", "==", busId)
      .where("tripStatus", "==", "active")
      .limit(1)
      .get();
    if (assigned || !activeTrip.empty) {
      fail(res, "لا يمكن حذف باص عليه سائق أو رحلة مفتوحة. فك التعيين أولاً.", 409);
      return;
    }

    await busRef.delete();

    ok(res, { busId, deleted: true });
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

export default router;
