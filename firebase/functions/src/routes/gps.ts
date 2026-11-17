import { Router } from "express";
import { COLLECTIONS, isWithinGeofence } from "@tardadi/shared";
import type { GeoPoint } from "@tardadi/shared";
import { db } from "../firebase";
import { HttpError } from "../auth/middleware";
import { tripMatchesActor } from "../auth/driverAccess";
import { requireTripWriter, resolveTripActor } from "../auth/tripAuth";
import { businessRef } from "../business/helpers";
import { fail, ok } from "../utils";
import { rejectStoreReviewAccess } from "../services/passengerReview";

const router = Router();

router.use(rejectStoreReviewAccess);

router.post("/", requireTripWriter, async (req, res) => {
  try {
    const actor = resolveTripActor(req);
    const orgId = actor.businessId;
    const driverId = actor.driverId;
    const { tripId, busId, latitude, longitude, speedKmh, heading, crowdLevel, onBreak } =
      req.body;

    if (
      !tripId ||
      !driverId ||
      !busId ||
      latitude === undefined ||
      longitude === undefined
    ) {
      fail(res, "tripId, driverId, busId, latitude, and longitude are required");
      return;
    }

    const tripRef = businessRef(db, orgId)
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

    if (!tripMatchesActor(trip, driverId, busId)) {
      fail(res, "Trip does not match driver or bus", 403);
      return;
    }

    const stopsSnapshot = await businessRef(db, orgId)
      .collection(COLLECTIONS.routes)
      .doc(trip.routeId)
      .collection(COLLECTIONS.stops)
      .get();

    const stopPoints: GeoPoint[] = stopsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return { latitude: data.latitude, longitude: data.longitude };
    });

    const currentPoint: GeoPoint = { latitude, longitude };
    const withinGeofence = isWithinGeofence(currentPoint, stopPoints);

    const now = new Date().toISOString();
    const gpsRef = await tripRef.collection(COLLECTIONS.gpsLogs).add({
      latitude,
      longitude,
      speedKmh: speedKmh ?? null,
      heading: heading ?? null,
      capturedAt: now,
    });

    const tripUpdate: Record<string, unknown> = {
      updatedAt: now,
      ...(crowdLevel ? { crowdLevel } : {}),
    };

    if (onBreak === true) {
      tripUpdate.onBreak = true;
      tripUpdate.breakStartedAt = now;
    } else if (onBreak === false) {
      const breakStartedAt = trip.breakStartedAt as string | undefined;
      const breakHistory = [
        ...((trip.breakHistory as Array<{ startedAt: string; endedAt: string }>) ??
          []),
      ];
      if (breakStartedAt) {
        breakHistory.push({ startedAt: breakStartedAt, endedAt: now });
      }
      tripUpdate.onBreak = false;
      tripUpdate.breakStartedAt = null;
      tripUpdate.breakEndedAt = now;
      tripUpdate.breakHistory = breakHistory;
    }

    await businessRef(db, orgId)
      .collection(COLLECTIONS.buses)
      .doc(busId)
      .update({
        currentLocation: { latitude, longitude },
        lastSeenAt: now,
        updatedAt: now,
        ...(crowdLevel ? { crowdLevel } : {}),
      });

    await tripRef.update(tripUpdate);

    ok(res, {
      gpsLogId: gpsRef.id,
      tripId,
      latitude,
      longitude,
      capturedAt: now,
      withinGeofence,
    }, 201);
  } catch (error) {
    const err = error as HttpError;
    fail(res, err.message, err.status ?? 500);
  }
});

export default router;
