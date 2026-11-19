export const STALE_TRIP_MS = 15 * 60 * 1000;
export const STALE_BREAK_MS = 60 * 60 * 1000;
export const LIVE_GPS_WINDOW_MS = 3 * 60 * 1000;
export const AUTO_CLOSE_REASON = "auto_closed_inactive";

export interface StaleTripInput {
  onBreak?: boolean;
  breakStartedAt?: string | null;
  lastSeenAt?: string | null;
  startedAt?: string | null;
}

export interface StaleTripDecision {
  close: boolean;
  endedAt: string | null;
}

function timeOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : null;
}

/** Last GPS time, then the break start, then when the trip was opened. */
export function lastLocationIso(input: StaleTripInput): string | null {
  if (input.lastSeenAt && timeOf(input.lastSeenAt) != null) return input.lastSeenAt;
  if (input.onBreak && input.breakStartedAt && timeOf(input.breakStartedAt) != null) {
    return input.breakStartedAt;
  }
  if (input.startedAt && timeOf(input.startedAt) != null) return input.startedAt;
  return null;
}

export function decideStaleTrip(
  input: StaleTripInput,
  now = Date.now()
): StaleTripDecision {
  const endedAt = lastLocationIso(input);
  const anchor = input.onBreak
    ? timeOf(input.breakStartedAt) ?? timeOf(endedAt)
    : timeOf(endedAt);
  if (anchor == null || endedAt == null) {
    return { close: false, endedAt: null };
  }
  const limit = input.onBreak ? STALE_BREAK_MS : STALE_TRIP_MS;
  return {
    close: now - anchor >= limit,
    endedAt,
  };
}
