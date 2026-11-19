import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_CLOSE_REASON,
  STALE_BREAK_MS,
  STALE_TRIP_MS,
  decideStaleTrip,
} from "../dist/jobs/staleTripDecision.js";

const now = Date.parse("2026-11-19T20:00:00.000Z");

test("an open trip with a fresh location stays open", () => {
  const decision = decideStaleTrip(
    {
      lastSeenAt: new Date(now - 2 * 60 * 1000).toISOString(),
      startedAt: new Date(now - 30 * 60 * 1000).toISOString(),
    },
    now
  );
  assert.equal(decision.close, false);
});

test("an open trip whose last location is older than 15 minutes closes", () => {
  const lastSeenAt = new Date(now - STALE_TRIP_MS - 1000).toISOString();
  const decision = decideStaleTrip({ lastSeenAt, startedAt: lastSeenAt }, now);
  assert.equal(decision.close, true);
  assert.equal(decision.endedAt, lastSeenAt);
  assert.equal(AUTO_CLOSE_REASON, "auto_closed_inactive");
});

test("a trip with no GPS closes from its start time after 15 minutes", () => {
  const startedAt = new Date(now - 16 * 60 * 1000).toISOString();
  const decision = decideStaleTrip({ startedAt }, now);
  assert.equal(decision.close, true);
  assert.equal(decision.endedAt, startedAt);
});

test("a break shorter than 60 minutes stays open even if GPS stopped", () => {
  const breakStartedAt = new Date(now - 20 * 60 * 1000).toISOString();
  const decision = decideStaleTrip(
    {
      onBreak: true,
      breakStartedAt,
      lastSeenAt: breakStartedAt,
    },
    now
  );
  assert.equal(decision.close, false);
});

test("a break longer than 60 minutes closes at the last location time", () => {
  const lastSeenAt = new Date(now - STALE_BREAK_MS - 1000).toISOString();
  const decision = decideStaleTrip(
    {
      onBreak: true,
      breakStartedAt: lastSeenAt,
      lastSeenAt,
    },
    now
  );
  assert.equal(decision.close, true);
  assert.equal(decision.endedAt, lastSeenAt);
});
