import { COLLECTIONS } from "@tardadi/shared";
import { db } from "../firebase";
import { businessRef } from "../business/helpers";
import {
  AUTO_CLOSE_REASON,
  decideStaleTrip,
  type StaleTripInput,
} from "./staleTripDecision";

export async function finalizeTrip(options: {
  businessId: string;
  tripId: string;
  endedAt: string;
  endReason?: string;
}): Promise<void> {
  const tripRef = businessRef(db, options.businessId)
    .collection(COLLECTIONS.trips)
    .doc(options.tripId);
  const tripDoc = await tripRef.get();
  if (!tripDoc.exists) return;

  const trip = tripDoc.data() ?? {};
  const now = new Date().toISOString();
  await tripRef.update({
    tripStatus: "ended",
    endedAt: options.endedAt,
    onBreak: false,
    breakStartedAt: null,
    updatedAt: now,
    ...(options.endReason ? { endReason: options.endReason } : {}),
  });

  const busId = trip.busId as string | undefined;
  if (!busId) return;
  const busRef = businessRef(db, options.businessId)
    .collection(COLLECTIONS.buses)
    .doc(busId);
  const busDoc = await busRef.get();
  if (!busDoc.exists) return;
  const currentTripId = busDoc.data()?.currentTripId as string | null | undefined;
  if (currentTripId && currentTripId !== options.tripId) return;
  await busRef.update({
    currentTripId: null,
    updatedAt: now,
  });
}

export async function closeStaleTrips(now = new Date()): Promise<{ closed: number }> {
  const businesses = await db.collection(COLLECTIONS.businesses).get();
  let closed = 0;

  for (const business of businesses.docs) {
    const trips = await business.ref
      .collection(COLLECTIONS.trips)
      .where("tripStatus", "==", "active")
      .get();

    for (const tripDoc of trips.docs) {
      const trip = tripDoc.data();
      const busId = trip.busId as string | undefined;
      let lastSeenAt: string | null = null;
      if (busId) {
        const busDoc = await business.ref.collection(COLLECTIONS.buses).doc(busId).get();
        lastSeenAt = (busDoc.data()?.lastSeenAt as string | undefined) ?? null;
      }
      const input: StaleTripInput = {
        onBreak: trip.onBreak === true,
        breakStartedAt: (trip.breakStartedAt as string | undefined) ?? null,
        lastSeenAt,
        startedAt:
          (trip.startedAt as string | undefined) ??
          (trip.createdAt as string | undefined) ??
          null,
      };
      const decision = decideStaleTrip(input, now.getTime());
      if (!decision.close || !decision.endedAt) continue;
      await finalizeTrip({
        businessId: business.id,
        tripId: tripDoc.id,
        endedAt: decision.endedAt,
        endReason: AUTO_CLOSE_REASON,
      });
      closed += 1;
    }
  }

  return { closed };
}
