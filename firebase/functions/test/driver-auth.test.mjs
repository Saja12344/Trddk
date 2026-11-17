import test from "node:test";
import assert from "node:assert/strict";
import { isAdminPanelRole } from "@tardadi/shared";
import { verifyJwt, getJwtSecret } from "../dist/auth/crypto.js";
import {
  DRIVER_LOGIN_DENIED,
  DRIVER_SESSION_ROLE,
  DRIVER_WRITE_FIELDS,
  assertBodyDriver,
  driverLoginDecision,
  driverMayStartTrip,
  driverStartDelivery,
  pickAllowedFields,
  reminderOwner,
  scopedBusinessId,
  signDriverSessionToken,
  tripMatchesActor,
} from "../dist/auth/driverAccess.js";

process.env.ADMIN_JWT_SECRET ??= "unit-test-jwt-secret-32chars-minimum!";

test("phone-only driver login is rejected before any lookup", () => {
  const missing = driverLoginDecision(undefined);
  const blank = driverLoginDecision("   ");
  const phoneOnly = driverLoginDecision(null);
  for (const decision of [missing, blank, phoneOnly]) {
    assert.equal(decision.ok, false);
    assert.equal(decision.status, 401);
    assert.equal(decision.error, DRIVER_LOGIN_DENIED);
  }

  const accepted = driverLoginDecision(" firebase-id-token ");
  assert.equal(accepted.ok, true);
  assert.equal(accepted.idToken, "firebase-id-token");
});

test("driver session token is not an admin session", () => {
  const token = signDriverSessionToken("driver-1", "biz-1", "Noura");
  const payload = verifyJwt(token, getJwtSecret());
  assert.equal(payload?.role, DRIVER_SESSION_ROLE);
  assert.equal(payload?.sub, "driver-1");
  assert.equal(payload?.businessId, "biz-1");
  assert.equal(payload?.phone, "");
  assert.equal(isAdminPanelRole(payload?.role ?? ""), false);
  assert.equal(isAdminPanelRole("driver_session"), false);
});

test("a driver token cannot claim another driver or business", () => {
  assert.deepEqual(assertBodyDriver("driver-1", "driver-2"), {
    ok: false,
    status: 403,
  });
  assert.deepEqual(assertBodyDriver("driver-1", "driver-1"), { ok: true });
  assert.deepEqual(assertBodyDriver("driver-1", undefined), { ok: true });

  assert.deepEqual(scopedBusinessId("biz-1", "biz-2"), { ok: false, status: 403 });
  assert.deepEqual(scopedBusinessId("biz-1", "biz-1"), {
    ok: true,
    businessId: "biz-1",
  });
  assert.deepEqual(scopedBusinessId("biz-1", null), {
    ok: true,
    businessId: "biz-1",
  });
  assert.equal(scopedBusinessId(null, "biz-1").ok, false);
});

test("trip ownership and assigned bus are enforced", () => {
  assert.equal(
    tripMatchesActor({ driverId: "driver-1", busId: "bus-1" }, "driver-1", "bus-1"),
    true
  );
  assert.equal(
    tripMatchesActor({ driverId: "driver-1", busId: "bus-1" }, "driver-2", "bus-1"),
    false
  );
  assert.equal(
    tripMatchesActor({ driverId: "driver-1", busId: "bus-1" }, "driver-1", "bus-9"),
    false
  );
  assert.equal(driverMayStartTrip("bus-1", "route-1", "bus-1", "route-1"), true);
  assert.equal(driverMayStartTrip("bus-1", "route-1", "bus-2", "route-1"), false);
  assert.equal(driverMayStartTrip(null, "route-1", "bus-1", "route-1"), false);
});

test("unknown and registered driver start responses match before delivery", () => {
  const unknown = driverStartDelivery(false);
  const registered = driverStartDelivery(true);
  assert.equal(unknown.sent, true);
  assert.equal(registered.sent, true);
  assert.equal(unknown.deliverSms, false);
  assert.equal(registered.deliverSms, true);
  assert.deepEqual(
    { sent: unknown.sent },
    { sent: registered.sent }
  );
});

test("writes keep only allowlisted fields and reminder owner", () => {
  const updates = pickAllowedFields(
    {
      name: "Line A",
      businessId: "other-biz",
      organizationId: "other-biz",
      role: "super_admin",
      phone: "+966500000000",
    },
    DRIVER_WRITE_FIELDS
  );
  assert.deepEqual(updates, { name: "Line A", phone: "+966500000000" });
  assert.equal("businessId" in updates, false);
  assert.equal("role" in updates, false);

  assert.deepEqual(reminderOwner("user-1", "user-2"), { ok: false, status: 403 });
  assert.deepEqual(reminderOwner("user-1", "user-1"), { ok: true, userId: "user-1" });
  assert.deepEqual(reminderOwner("user-1", undefined), { ok: true, userId: "user-1" });
});
