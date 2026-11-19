import type { Bus, Trip } from "@tardadi/shared";

/** GPS is sent about every 2s while a trip is actually running. */
const GPS_FRESH_MS = 3 * 60 * 1000;
/** A break pauses GPS, so the break itself stays visible for a while. */
const BREAK_FRESH_MS = 2 * 60 * 60 * 1000;

export type LiveTripState = "driving" | "break" | "idle";

function within(iso: string | null | undefined, windowMs: number, now: number) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && now - time <= windowMs;
}

/** An open trip record is not a live trip unless the bus was seen recently. */
export function liveTripState(
  trip: Trip | null | undefined,
  bus: Bus | null | undefined,
  now = Date.now()
): LiveTripState {
  if (!trip || trip.tripStatus !== "active") return "idle";
  const seen = within(bus?.lastSeenAt, GPS_FRESH_MS, now);
  if (trip.onBreak) {
    if (seen || within(trip.breakStartedAt, BREAK_FRESH_MS, now)) return "break";
    return "idle";
  }
  return seen ? "driving" : "idle";
}
