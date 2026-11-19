import test from "node:test";
import assert from "node:assert/strict";
import { decidePrivateRouteAccess } from "../dist/services/privateRouteAccess.js";
import { driverPhoneConflict } from "../dist/services/driverPhone.js";
import {
  decideBusAssignment,
  decideBusRouteMove,
} from "../dist/services/driverAssignmentRules.js";
import { roleHasPermission } from "@tardadi/shared";

test("a private route is hidden from someone who is not a member", () => {
  const decision = decidePrivateRouteAccess({
    accessMode: "private",
    isAdmin: false,
    passengerBusinessId: null,
    routeBusinessId: "company",
    membershipAllowsPassenger: false,
  });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.status, 403);
});

test("a company passenger still sees the private routes of their company", () => {
  const decision = decidePrivateRouteAccess({
    accessMode: "private",
    isAdmin: false,
    passengerBusinessId: "company",
    routeBusinessId: "company",
    membershipAllowsPassenger: true,
  });
  assert.equal(decision.allowed, true);
});

test("a passenger of another company does not see this private route", () => {
  const decision = decidePrivateRouteAccess({
    accessMode: "private",
    isAdmin: false,
    passengerBusinessId: "other",
    routeBusinessId: "company",
    membershipAllowsPassenger: true,
  });
  assert.equal(decision.allowed, false);
});

test("public routes stay open", () => {
  const decision = decidePrivateRouteAccess({
    accessMode: "public",
    isAdmin: false,
    routeBusinessId: "company",
    membershipAllowsPassenger: false,
  });
  assert.equal(decision.allowed, true);
});

test("an admin still sees a private route", () => {
  const decision = decidePrivateRouteAccess({
    accessMode: "private",
    isAdmin: true,
    routeBusinessId: "company",
    membershipAllowsPassenger: false,
  });
  assert.equal(decision.allowed, true);
});

test("a new driver cannot take a phone already used in another company", () => {
  const decision = driverPhoneConflict({
    normalizedPhone: "+966579410851",
    businessId: "new-co",
    owners: [
      {
        businessId: "naql",
        driverId: "ff",
        name: "FF",
        phone: "+966579410851",
      },
    ],
  });
  assert.equal(decision.ok, false);
});

test("the existing duplicate phone can still be saved on the same driver", () => {
  const decision = driverPhoneConflict({
    normalizedPhone: "+966579410851",
    businessId: "naql",
    driverId: "ff",
    previousPhone: "+966579410851",
    owners: [
      { businessId: "naql", driverId: "ff", name: "FF", phone: "+966579410851" },
      { businessId: "ff-co", driverId: "kumar", name: "كومار", phone: "+966579410851" },
    ],
  });
  assert.equal(decision.ok, true);
});

test("assignment refuses a bus that has no route", () => {
  const decision = decideBusAssignment({
    busRouteId: null,
    activeTrip: false,
    replace: false,
  });
  assert.equal(decision.ok, false);
});

test("assignment names the driver who already has the bus", () => {
  const decision = decideBusAssignment({
    busRouteId: "route",
    occupantDriverId: "other",
    occupantName: "FF",
    driverId: "new",
    activeTrip: false,
    replace: false,
  });
  assert.equal(decision.ok, false);
  if (!decision.ok) assert.match(decision.message, /FF/);
});

test("replacing a driver is refused while the bus has an open trip", () => {
  const decision = decideBusAssignment({
    busRouteId: "route",
    occupantDriverId: "other",
    occupantName: "FF",
    driverId: "new",
    activeTrip: true,
    replace: true,
  });
  assert.equal(decision.ok, false);
});

test("moving a bus is refused during an open trip and allowed otherwise", () => {
  assert.equal(decideBusRouteMove(true).ok, false);
  assert.equal(decideBusRouteMove(false).ok, true);
});

test("a viewer can read operations data and cannot create a driver", () => {
  assert.equal(roleHasPermission("business_viewer", "drivers:read"), true);
  assert.equal(roleHasPermission("business_viewer", "trips:read"), true);
  assert.equal(roleHasPermission("business_viewer", "drivers:write"), false);
  assert.equal(roleHasPermission("business_viewer", "users:invite"), false);
});
