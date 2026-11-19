import { Router } from "express";
import { COLLECTIONS, totalStationCount } from "@tardadi/shared";
import { db } from "../firebase";
import { optionalAdminWithPermission, requirePermission } from "../auth/middleware";
import { ROUTE_WRITE_FIELDS, pickAllowedFields } from "../auth/driverAccess";
import { resolveBusinessId, requireBusinessId, withBusinessId } from "../auth/scope";
import {
  listAccessibleBusinessIds,
  mapAcrossBusinesses,
} from "../business/access";
import { businessRef } from "../business/helpers";
import { fail, ok, paramId } from "../utils";
import { withTranslatedNames } from "../services/translate";
import {
  isPublicPassengerRoute,
  omitReviewPrivateFields,
  rejectStoreReviewAccess,
  requestIsPassengerReview,
  STORE_REVIEW_FORBIDDEN,
} from "../services/passengerReview";

const router = Router();

router.use((req, res, next) => {
  if (req.method === "GET") {
    next();
    return;
  }
  rejectStoreReviewAccess(req, res, next);
});

const LIVE_GPS_WINDOW_MS = 3 * 60 * 1000;

function isRecentlyUpdated(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  const seen = new Date(lastSeenAt).getTime();
  if (Number.isNaN(seen)) return false;
  return Date.now() - seen <= LIVE_GPS_WINDOW_MS;
}

async function listRoutesForBusiness(businessId: string) {
  const bizRef = businessRef(db, businessId);
  const [routesSnapshot, tripsSnapshot, busesSnapshot] = await Promise.all([
    bizRef.collection(COLLECTIONS.routes).get(),
    bizRef.collection(COLLECTIONS.trips).where("tripStatus", "==", "active").get(),
    bizRef.collection(COLLECTIONS.buses).get(),
  ]);

  const busById = new Map(
    busesSnapshot.docs.map((doc) => [
      doc.id,
      { busId: doc.id, ...doc.data() } as { busId: string; lastSeenAt?: string },
    ])
  );

  const activeTripsByRoute = new Map<string, typeof tripsSnapshot.docs>();
  for (const tripDoc of tripsSnapshot.docs) {
    const routeId = tripDoc.data().routeId as string;
    const list = activeTripsByRoute.get(routeId) ?? [];
    list.push(tripDoc);
    activeTripsByRoute.set(routeId, list);
  }

  return Promise.all(
    routesSnapshot.docs.map(async (doc) => {
      const routeId = doc.id;
      const stopsSnapshot = await doc.ref.collection(COLLECTIONS.stops).get();
      const activeTrips = activeTripsByRoute.get(routeId) ?? [];
      let liveBusCount = 0;

      for (const tripDoc of activeTrips) {
        const trip = tripDoc.data();
        if (trip.onBreak === true) continue;
        const busId = trip.busId as string;
        const bus = busById.get(busId);
        if (bus && isRecentlyUpdated(bus.lastSeenAt as string | undefined)) {
          liveBusCount += 1;
        }
      }

      const routeData = doc.data();
      const intermediateStops = stopsSnapshot.size;

      return withBusinessId(businessId, {
        routeId,
        ...routeData,
        stopsCount: totalStationCount(intermediateStops, {
          hasFrom: !!routeData.fromLocation,
          hasTo: !!routeData.toLocation,
        }),
        intermediateStopsCount: intermediateStops,
        activeBusCount: activeTrips.length,
        liveBusCount,
      });
    })
  );
}

router.get("/", optionalAdminWithPermission("routes:read"), async (req, res) => {
  try {
    const scope = req.query.scope as string | undefined;
    const review = requestIsPassengerReview(req);

    // Personal passengers and the store-review session only see public routes.
    if (review || (!req.adminAuth && scope === "public")) {
      const snap = await db.collection(COLLECTIONS.businesses).get();
      const businessIds = snap.docs.map((doc) => doc.id);
      const routes = await mapAcrossBusinesses(db, businessIds, listRoutesForBusiness);
      ok(
        res,
        await withTranslatedNames(
          routes
            .filter((route) =>
              isPublicPassengerRoute(route as { status?: string; accessMode?: string })
            )
            .map((route) =>
              review
                ? omitReviewPrivateFields(route as Record<string, unknown>)
                : (route as Record<string, unknown>)
            )
        )
      );
      return;
    }

    const businessId = resolveBusinessId(req, req.adminAuth);
    const businessIds = await listAccessibleBusinessIds(
      db,
      req.adminAuth,
      businessId
    );
    const routes = await mapAcrossBusinesses(db, businessIds, listRoutesForBusiness);
    ok(res, await withTranslatedNames(routes as Record<string, unknown>[]));
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

router.get("/:routeId/live", async (req, res) => {
  try {
    const businessId = requireBusinessId(req, req.adminAuth);
    const routeId = paramId(req.params.routeId);

    const routeRef = businessRef(db, businessId)
      .collection(COLLECTIONS.routes)
      .doc(routeId);

    const routeDoc = await routeRef.get();
    if (!routeDoc.exists) {
      fail(res, "Route not found", 404);
      return;
    }

    const review = requestIsPassengerReview(req);
    const routeData = routeDoc.data() ?? {};
    if (
      review &&
      !isPublicPassengerRoute(routeData as { status?: string; accessMode?: string })
    ) {
      fail(res, STORE_REVIEW_FORBIDDEN, 403);
      return;
    }

    const [stopsSnapshot, tripsSnapshot] = await Promise.all([
      routeRef.collection(COLLECTIONS.stops).orderBy("sequenceNo").get(),
      businessRef(db, businessId)
        .collection(COLLECTIONS.trips)
        .where("routeId", "==", routeId)
        .where("tripStatus", "==", "active")
        .get(),
    ]);

    const stops = stopsSnapshot.docs.map((doc) => ({
      stopId: doc.id,
      routeId,
      ...doc.data(),
    }));

    const buses = [];
    let liveBusCount = 0;

    for (const tripDoc of tripsSnapshot.docs) {
      const trip = tripDoc.data();
      if (trip.onBreak === true) continue;

      const busDoc = await businessRef(db, businessId)
        .collection(COLLECTIONS.buses)
        .doc(trip.busId as string)
        .get();

      if (!busDoc.exists) continue;

      const busData = busDoc.data()!;
      const isLive = isRecentlyUpdated(busData.lastSeenAt as string | undefined);
      if (isLive) liveBusCount += 1;

      const busPayload = {
        ...withBusinessId(businessId, { busId: busDoc.id, ...busData }),
        tripId: tripDoc.id,
        lastArrivedAt:
          (trip.lastArrivedAt as string | undefined) ??
          (busData.lastArrivedAt as string | undefined) ??
          null,
        lastArrivedStopId:
          (trip.lastArrivedStopId as string | undefined) ??
          (busData.lastArrivedStopId as string | undefined) ??
          null,
        isLive,
      };
      buses.push(review ? omitReviewPrivateFields(busPayload) : busPayload);
    }

    const routePayload = withBusinessId(businessId, {
      routeId,
      ...routeData,
      stopsCount: totalStationCount(stops.length, {
        hasFrom: !!routeData.fromLocation,
        hasTo: !!routeData.toLocation,
      }),
      intermediateStopsCount: stops.length,
    });

    const [translatedRoute] = await withTranslatedNames([
      (review ? omitReviewPrivateFields(routePayload) : routePayload) as Record<string, unknown>,
    ]);
    ok(res, {
      route: translatedRoute,
      stops: await withTranslatedNames(stops as Record<string, unknown>[]),
      buses,
      liveBusCount,
      activeBusCount: tripsSnapshot.size,
    });
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

router.get("/:routeId", optionalAdminWithPermission("routes:read"), async (req, res) => {
  try {
    const businessId = requireBusinessId(req, req.adminAuth);
    const routeId = paramId(req.params.routeId);

    const routeRef = businessRef(db, businessId)
      .collection(COLLECTIONS.routes)
      .doc(routeId);

    const routeDoc = await routeRef.get();
    if (!routeDoc.exists) {
      fail(res, "Route not found", 404);
      return;
    }

    const stopsSnapshot = await routeRef
      .collection(COLLECTIONS.stops)
      .orderBy("sequenceNo")
      .get();
    const stops = stopsSnapshot.docs.map((doc) => ({
      stopId: doc.id,
      routeId,
      ...doc.data(),
    }));

    const routeData = routeDoc.data()!;
    const review = requestIsPassengerReview(req);
    if (
      review &&
      !isPublicPassengerRoute(routeData as { status?: string; accessMode?: string })
    ) {
      fail(res, STORE_REVIEW_FORBIDDEN, 403);
      return;
    }
    const intermediateStops = stopsSnapshot.size;
    const routePayload = withBusinessId(businessId, {
      routeId,
      ...routeData,
      stopsCount: totalStationCount(intermediateStops, {
        hasFrom: !!routeData.fromLocation,
        hasTo: !!routeData.toLocation,
      }),
      intermediateStopsCount: intermediateStops,
    });

    const [translatedRoute] = await withTranslatedNames([
      (review ? omitReviewPrivateFields(routePayload) : routePayload) as Record<string, unknown>,
    ]);
    ok(res, {
      route: translatedRoute,
      stops: await withTranslatedNames(stops as Record<string, unknown>[]),
    });
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

router.post("/", requirePermission("routes:write"), async (req, res) => {
  try {
    const businessId = requireBusinessId(req, req.adminAuth);
    const {
      name,
      code,
      colorHex,
      status = "active",
      accessMode = "public",
      polyline,
      fromLocation,
      toLocation,
      stops = [],
    } = req.body;

    if (!name || !code) {
      fail(res, "name and code are required");
      return;
    }

    if (
      !fromLocation?.address ||
      typeof fromLocation.latitude !== "number" ||
      typeof fromLocation.longitude !== "number"
    ) {
      fail(res, "fromLocation (address, latitude, longitude) is required");
      return;
    }

    if (
      !toLocation?.address ||
      typeof toLocation.latitude !== "number" ||
      typeof toLocation.longitude !== "number"
    ) {
      fail(res, "toLocation (address, latitude, longitude) is required");
      return;
    }

    const now = new Date().toISOString();
    const docRef = await businessRef(db, businessId)
      .collection(COLLECTIONS.routes)
      .add({
        name,
        code,
        colorHex: colorHex || "#FF6B00",
        status,
        accessMode: accessMode === "private" ? "private" : "public",
        fromLocation,
        toLocation,
        polyline: polyline || null,
        createdAt: now,
        updatedAt: now,
      });

    if (Array.isArray(stops) && stops.length > 0) {
      const batch = db.batch();
      stops.forEach((stop: Record<string, unknown>, index: number) => {
        if (
          typeof stop.latitude !== "number" ||
          typeof stop.longitude !== "number"
        ) {
          return;
        }
        const stopRef = docRef.collection(COLLECTIONS.stops).doc();
        batch.set(stopRef, {
          name: (stop.name as string) || `محطة ${index + 1}`,
          latitude: stop.latitude,
          longitude: stop.longitude,
          sequenceNo: (stop.sequenceNo as number) ?? index + 1,
          geofenceRadiusM: 500,
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
      });
      await batch.commit();
    }

    ok(
      res,
      withBusinessId(businessId, {
        routeId: docRef.id,
        name,
        code,
        colorHex: colorHex || "#FF6B00",
        status,
        accessMode: accessMode === "private" ? "private" : "public",
        fromLocation,
        toLocation,
      }),
      201
    );
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

router.put("/:routeId", requirePermission("routes:write"), async (req, res) => {
  try {
    const businessId = requireBusinessId(req, req.adminAuth);
    const routeId = paramId(req.params.routeId);
    const updates = {
      ...pickAllowedFields(req.body ?? {}, ROUTE_WRITE_FIELDS),
      updatedAt: new Date().toISOString(),
    };

    await businessRef(db, businessId)
      .collection(COLLECTIONS.routes)
      .doc(routeId)
      .update(updates);

    ok(res, withBusinessId(businessId, { routeId, ...updates }));
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

router.delete("/:routeId", requirePermission("routes:write"), async (req, res) => {
  try {
    const businessId = requireBusinessId(req, req.adminAuth);
    const routeId = paramId(req.params.routeId);

    await businessRef(db, businessId)
      .collection(COLLECTIONS.routes)
      .doc(routeId)
      .delete();

    ok(res, { routeId, deleted: true });
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 500);
  }
});

export default router;
