import { Router } from "express";
import type { Query } from "firebase-admin/firestore";
import { COLLECTIONS } from "@tardadi/shared";
import { db } from "../firebase";
import { HttpError, optionalAdminWithPermission } from "../auth/middleware";
import { driverMayStartTrip, tripMatchesActor } from "../auth/driverAccess";
import { requireTripWriter, resolveTripActor } from "../auth/tripAuth";
import { resolveBusinessId, withBusinessId } from "../auth/scope";
import {
  listAccessibleBusinessIds,
  mapAcrossBusinesses,
} from "../business/access";
import { businessRef } from "../business/helpers";
import { fail, ok } from "../utils";
import { finalizeTrip } from "../jobs/closeStaleTrips";
import { rejectStoreReviewAccess } from "../services/passengerReview";

const router = Router();

router.use(rejectStoreReviewAccess);

async function listTripsForBusiness(businessId: string, status?: string) {
  let query: Query = businessRef(db, businessId).collection(COLLECTIONS.trips);
  if (status) {
    query = query.where("tripStatus", "==", status);
  }
  const snapshot = await query.get();
  return snapshot.docs
    .map((doc) =>
      withBusinessId(businessId, { tripId: doc.id, ...doc.data() })
    )
    .sort((a, b) => {
      const left = String((b as { updatedAt?: string }).updatedAt || "");
      const right = String((a as { updatedAt?: string }).updatedAt || "");
      return left.localeCompare(right);
    });
}

router.get("/", optionalAdminWithPermission("trips:read"), async (req, res) => {
  try {
    const businessId = resolveBusinessId(req, req.adminAuth);
    const status = req.query.status as string | undefined;
    const businessIds = await listAccessibleBusinessIds(
      db,
      req.adminAuth,
      businessId
    );
    const trips = await mapAcrossBusinesses(db, businessIds, (id) =>
      listTripsForBusiness(id, status)
    );
    ok(res, trips);
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

router.post("/start", requireTripWriter, async (req, res) => {
  try {
    const actor = resolveTripActor(req);
    const { busId, routeId } = req.body as { busId?: string; routeId?: string };
    const driverId = actor.driverId;

    if (!driverId || !busId || !routeId) {
      fail(res, "driverId, busId, and routeId are required");
      return;
    }

    const businessId = actor.businessId;
    const driverDoc = await businessRef(db, businessId)
      .collection(COLLECTIONS.drivers)
      .doc(driverId)
      .get();
    if (!driverDoc.exists) {
      fail(res, "Driver not found", 404);
      return;
    }

    const assigned = driverDoc.data() ?? {};
    if (
      actor.isDriver &&
      !driverMayStartTrip(
        assigned.assignedBusId as string | undefined,
        assigned.assignedRouteId as string | undefined,
        busId,
        routeId
      )
    ) {
      fail(res, "لا يمكنك بدء رحلة على حافلة أو خط غير معيّن لك.", 403);
      return;
    }

    const busDoc = await businessRef(db, businessId)
      .collection(COLLECTIONS.buses)
      .doc(busId)
      .get();
    if (!busDoc.exists) {
      fail(res, "Assigned bus not found.", 404);
      return;
    }

    const activeTrips = await businessRef(db, businessId)
      .collection(COLLECTIONS.trips)
      .where("busId", "==", busId)
      .where("tripStatus", "==", "active")
      .limit(1)
      .get();

    if (!activeTrips.empty) {
      fail(res, "Bus already has an active trip", 409);
      return;
    }

    const now = new Date().toISOString();
    const tripRef = await businessRef(db, businessId)
      .collection(COLLECTIONS.trips)
      .add({
        busId,
        driverId,
        routeId,
        tripStatus: "active",
        startedAt: now,
        endedAt: null,
        createdAt: now,
        updatedAt: now,
      });

    await businessRef(db, businessId)
      .collection(COLLECTIONS.buses)
      .doc(busId)
      .update({
        currentTripId: tripRef.id,
        updatedAt: now,
      });

    ok(
      res,
      withBusinessId(businessId, {
        tripId: tripRef.id,
        busId,
        driverId,
        routeId,
        tripStatus: "active",
        startedAt: now,
      }),
      201
    );
  } catch (error) {
    const err = error as HttpError;
    fail(res, err.message, err.status ?? 500);
  }
});

router.post("/arrived", requireTripWriter, async (req, res) => {
  try {
    const actor = resolveTripActor(req);
    const businessId = actor.businessId;
    const driverId = actor.driverId;
    const { tripId, stopId } = req.body as { tripId?: string; stopId?: string };

    if (!tripId || !driverId) {
      fail(res, "tripId and driverId are required");
      return;
    }

    const tripRef = businessRef(db, businessId)
      .collection(COLLECTIONS.trips)
      .doc(tripId);

    const tripDoc = await tripRef.get();
    if (!tripDoc.exists) {
      fail(res, "Trip not found", 404);
      return;
    }

    const trip = tripDoc.data()!;
    if (trip.tripStatus !== "active") {
      fail(res, "Trip is not active", 400);
      return;
    }

    if (!tripMatchesActor(trip, driverId)) {
      fail(res, "Trip does not belong to this driver", 403);
      return;
    }

    const now = new Date().toISOString();
    const arrival = {
      lastArrivedAt: now,
      lastArrivedStopId: stopId ?? null,
      updatedAt: now,
    };

    await tripRef.update(arrival);

    await businessRef(db, businessId)
      .collection(COLLECTIONS.buses)
      .doc(trip.busId as string)
      .update(arrival);

    ok(res, { tripId, arrivedAt: now, stopId: stopId ?? null });
  } catch (error) {
    const err = error as HttpError;
    fail(res, err.message, err.status ?? 500);
  }
});

router.post("/break", requireTripWriter, async (req, res) => {
  try {
    const actor = resolveTripActor(req);
    const businessId = actor.businessId;
    const driverId = actor.driverId;
    const { tripId, onBreak } = req.body as { tripId?: string; onBreak?: boolean };

    if (!tripId || !driverId || onBreak === undefined) {
      fail(res, "tripId, driverId, and onBreak are required");
      return;
    }

    const tripRef = businessRef(db, businessId)
      .collection(COLLECTIONS.trips)
      .doc(tripId);

    const tripDoc = await tripRef.get();
    if (!tripDoc.exists) {
      fail(res, "Trip not found", 404);
      return;
    }

    const trip = tripDoc.data()!;
    if (trip.tripStatus !== "active") {
      fail(res, "Trip is not active", 400);
      return;
    }

    if (!tripMatchesActor(trip, driverId)) {
      fail(res, "Trip does not belong to this driver", 403);
      return;
    }

    const now = new Date().toISOString();

    if (onBreak) {
      await tripRef.update({
        onBreak: true,
        breakStartedAt: now,
        updatedAt: now,
      });
      ok(res, { tripId, onBreak: true, breakStartedAt: now });
      return;
    }

    const breakStartedAt = trip.breakStartedAt as string | undefined;
    const breakHistory = [
      ...((trip.breakHistory as Array<{ startedAt: string; endedAt: string }>) ??
        []),
    ];
    if (breakStartedAt) {
      breakHistory.push({ startedAt: breakStartedAt, endedAt: now });
    }

    await tripRef.update({
      onBreak: false,
      breakStartedAt: null,
      breakEndedAt: now,
      breakHistory,
      updatedAt: now,
    });

    ok(res, {
      tripId,
      onBreak: false,
      breakEndedAt: now,
      breakHistory,
    });
  } catch (error) {
    const err = error as HttpError;
    fail(res, err.message, err.status ?? 500);
  }
});

router.post("/end", requireTripWriter, async (req, res) => {
  try {
    const actor = resolveTripActor(req);
    const businessId = actor.businessId;
    const driverId = actor.driverId;
    const { tripId } = req.body as { tripId?: string };

    if (!tripId || !driverId) {
      fail(res, "tripId and driverId are required");
      return;
    }

    const tripRef = businessRef(db, businessId)
      .collection(COLLECTIONS.trips)
      .doc(tripId);

    const tripDoc = await tripRef.get();
    if (!tripDoc.exists) {
      fail(res, "Trip not found", 404);
      return;
    }

    const tripData = tripDoc.data()!;
    if (!tripMatchesActor(tripData, driverId)) {
      fail(res, "Trip does not belong to this driver", 403);
      return;
    }

    const now = new Date().toISOString();
    await finalizeTrip({
      businessId,
      tripId,
      endedAt: now,
    });

    ok(res, { tripId, tripStatus: "ended", endedAt: now });
  } catch (error) {
    const err = error as HttpError;
    fail(res, err.message, err.status ?? 500);
  }
});

export default router;
