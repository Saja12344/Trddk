import { Router } from "express";
import { COLLECTIONS, normalizePhone, requireSaudiMobile } from "@tardadi/shared";
import { db } from "../firebase";
import { requirePermission } from "../auth/middleware";
import { DRIVER_WRITE_FIELDS, pickAllowedFields } from "../auth/driverAccess";
import { resolveBusinessId, requireBusinessId, withBusinessId } from "../auth/scope";
import { createOrLinkUser } from "../services/users";
import { DriverAssignmentError, saveDriverAssignment } from "../services/driverAssignment";
import { driverPhoneConflict } from "../services/driverPhone";
import {
  listAccessibleBusinessIds,
  mapAcrossBusinesses,
} from "../business/access";
import { businessRef } from "../business/helpers";
import { fail, ok, paramId } from "../utils";
import { rejectStoreReviewAccess } from "../services/passengerReview";

const router = Router();

router.use(rejectStoreReviewAccess);

async function listDriversForBusiness(businessId: string) {
  const snapshot = await businessRef(db, businessId)
    .collection(COLLECTIONS.drivers)
    .get();

  return snapshot.docs.map((doc) =>
    withBusinessId(businessId, {
      driverId: doc.id,
      ...doc.data(),
    })
  );
}

router.get("/", requirePermission("drivers:read"), async (req, res) => {
  try {
    const businessId = resolveBusinessId(req, req.adminAuth);
    const businessIds = await listAccessibleBusinessIds(
      db,
      req.adminAuth,
      businessId
    );
    const drivers = await mapAcrossBusinesses(db, businessIds, listDriversForBusiness);
    ok(res, drivers);
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

router.get("/me", requirePermission("drivers:read"), async (req, res) => {
  try {
    const businessId = resolveBusinessId(req, req.adminAuth);
    if (!businessId) {
      fail(res, "حدّد الشركة أولاً.");
      return;
    }

    const driverId = req.query.driverId as string;
    if (!driverId) {
      fail(res, "driverId is required");
      return;
    }

    const driverDoc = await businessRef(db, businessId)
      .collection(COLLECTIONS.drivers)
      .doc(driverId)
      .get();

    if (!driverDoc.exists) {
      fail(res, "Driver not found", 404);
      return;
    }

    ok(
      res,
      withBusinessId(businessId, {
        driverId,
        ...driverDoc.data(),
      })
    );
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

router.post("/", requirePermission("drivers:write"), async (req, res) => {
  try {
    const businessId = requireBusinessId(req, req.adminAuth);
    const name = String(req.body?.name ?? "").trim();
    const phone = String(req.body?.phone ?? "");
    const busId = (req.body?.busId || req.body?.assignedBusId || null) as string | null;
    if (!name || !phone) {
      fail(res, "name and phone are required");
      return;
    }

    const saved = await saveDriverAssignment(db, {
      businessId,
      name,
      phone,
      busId,
      driverId: (req.body?.driverId as string | undefined) ?? null,
      replace: req.body?.replace === true,
    });

    const prior = await db
      .collection(COLLECTIONS.users)
      .where("phone", "==", saved.phone)
      .limit(1)
      .get();
    const priorUid = prior.empty ? null : prior.docs[0].id;
    let existingPassenger = false;
    if (priorUid) {
      const membership = await db
        .collection(COLLECTIONS.users)
        .doc(priorUid)
        .collection(COLLECTIONS.memberships)
        .doc(businessId)
        .get();
      existingPassenger = membership.data()?.passengerAccess === true;
    }
    const keepPassenger =
      req.body?.keepPassenger === false
        ? false
        : req.body?.keepPassenger === true
          ? true
          : existingPassenger;

    const auth = req.adminAuth!;
    const linked = await createOrLinkUser({
      phone: saved.phone,
      displayName: name,
      primaryRole: keepPassenger ? "employee" : "driver",
      createdBy: auth.firebaseUser?.uid ?? auth.userId,
      businessId,
      membershipRole: keepPassenger ? "employee" : "driver",
      driverId: saved.driverId,
      source: "manual",
      passengerAccess: keepPassenger,
      driverAccess: true,
    });

    ok(
      res,
      withBusinessId(businessId, {
        driverId: saved.driverId,
        uid: linked.uid,
        name,
        phone: saved.phone,
        assignedRouteId: saved.routeId,
        assignedBusId: saved.busId,
        status: "active",
      }),
      201
    );
  } catch (error) {
    const err = error as DriverAssignmentError;
    fail(res, err.message, err.status ?? 400);
  }
});

router.put("/:driverId", requirePermission("drivers:write"), async (req, res) => {
  try {
    const businessId = requireBusinessId(req, req.adminAuth);
    const { driverId: rawDriverId } = req.params;
    const driverId = paramId(rawDriverId);
    const driverRef = businessRef(db, businessId)
      .collection(COLLECTIONS.drivers)
      .doc(driverId);
    const current = await driverRef.get();
    if (!current.exists) {
      fail(res, "Driver not found", 404);
      return;
    }

    const updates: Record<string, unknown> = {
      ...pickAllowedFields(req.body ?? {}, DRIVER_WRITE_FIELDS),
      updatedAt: new Date().toISOString(),
    };

    if (typeof updates.phone === "string") {
      const phone = requireSaudiMobile(updates.phone);
      const businesses = await db.collection(COLLECTIONS.businesses).get();
      const allOwners = [];
      for (const business of businesses.docs) {
        const drivers = await business.ref.collection(COLLECTIONS.drivers).get();
        for (const driver of drivers.docs) {
          const data = driver.data();
          const stored = (data.phone as string) || "";
          if (normalizePhone(stored) !== phone && stored !== phone) continue;
          allOwners.push({
            businessId: business.id,
            driverId: driver.id,
            name: (data.name as string) || "",
            phone: stored,
          });
        }
      }
      const conflict = driverPhoneConflict({
        normalizedPhone: phone,
        owners: allOwners,
        businessId,
        driverId,
        previousPhone: (current.data()?.phone as string | undefined) ?? null,
      });
      if (!conflict.ok) {
        fail(res, conflict.message, 409);
        return;
      }
      updates.phone = phone;
    }

    await driverRef.update(updates);

    ok(res, withBusinessId(businessId, { driverId, ...updates }));
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

router.delete("/:driverId", requirePermission("drivers:write"), async (req, res) => {
  try {
    const businessId = requireBusinessId(req, req.adminAuth);
    const { driverId: rawDriverId } = req.params;
    const driverId = paramId(rawDriverId);

    await businessRef(db, businessId)
      .collection(COLLECTIONS.drivers)
      .doc(driverId)
      .set(
        {
          status: "inactive",
          assignedRouteId: null,
          assignedBusId: null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

    ok(res, { driverId, deleted: false, deactivated: true });
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

export default router;
