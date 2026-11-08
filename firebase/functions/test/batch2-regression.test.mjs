import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { roleHasPermission } from "@tardadi/shared";
import { assertJwtSecret } from "../dist/auth/crypto.js";
import { isAllowedApiOrigin } from "../dist/http/corsPolicy.js";
import { isPublicPassengerRoute } from "../dist/services/passengerReview.js";
import {
  driverLoginDecision,
  reminderOwner,
  tripMatchesActor,
} from "../dist/auth/driverAccess.js";

const rulesPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../firestore.rules"
);

test("firestore rules no longer allow anonymous operational reads", () => {
  const rules = readFileSync(rulesPath, "utf8");
  assert.equal(rules.includes("allow read: if true"), false);
  assert.equal(rules.includes("allow create: if true"), false);
  assert.equal(rules.includes("allow update: if true"), false);
  assert.match(rules, /match \/drivers\/\{docId\}/);
  assert.match(rules, /match \/buses\/\{docId\}/);
  assert.match(rules, /match \/routes\/\{routeId\}/);
  assert.match(rules, /match \/stops\/\{stopId\}/);
  assert.match(rules, /match \/trips\/\{tripId\}/);
  assert.match(rules, /match \/gps_logs\/\{logId\}/);
  assert.match(rules, /match \/reminders\/\{reminderId\}/);
  assert.match(rules, /allow update, delete: if false/);
});

test("passenger public catalog keeps active public routes only", () => {
  assert.equal(
    isPublicPassengerRoute({ status: "active", accessMode: "public" }),
    true
  );
  assert.equal(
    isPublicPassengerRoute({ status: "active", accessMode: undefined }),
    true
  );
  assert.equal(
    isPublicPassengerRoute({ status: "active", accessMode: "private" }),
    false
  );
  assert.equal(
    isPublicPassengerRoute({ status: "inactive", accessMode: "public" }),
    false
  );
});

test("jwt secret must be present and must not be the old fallback", () => {
  assert.throws(
    () => assertJwtSecret(undefined),
    /ADMIN_JWT_SECRET is missing or unsafe/
  );
  assert.throws(
    () => assertJwtSecret("short-secret"),
    /ADMIN_JWT_SECRET is missing or unsafe/
  );
  assert.throws(
    () => assertJwtSecret("tardadi-dev-jwt-secret-change-in-production"),
    /ADMIN_JWT_SECRET is missing or unsafe/
  );
  assert.equal(
    assertJwtSecret("unit-test-jwt-secret-32chars-minimum!"),
    "unit-test-jwt-secret-32chars-minimum!"
  );
});

test("browser callers are limited to the admin site and local admin", () => {
  assert.equal(isAllowedApiOrigin(undefined), true);
  assert.equal(isAllowedApiOrigin("https://www.tardadi.com"), true);
  assert.equal(isAllowedApiOrigin("https://tardadi.com"), true);
  assert.equal(isAllowedApiOrigin("http://localhost:3000"), true);
  assert.equal(isAllowedApiOrigin("http://127.0.0.1:3000"), true);
  assert.equal(isAllowedApiOrigin("http://localhost:3001"), true);
  assert.equal(isAllowedApiOrigin("http://127.0.0.1:3001"), true);
  assert.equal(isAllowedApiOrigin("https://evil.example"), false);
  assert.equal(isAllowedApiOrigin("http://localhost:9999"), false);
});

test("driver login, trip ownership, reminders, and admin writes stay constrained", () => {
  assert.equal(driverLoginDecision(undefined).ok, false);
  assert.equal(
    tripMatchesActor({ driverId: "driver-1", busId: "bus-1" }, "driver-1", "bus-1"),
    true
  );
  assert.equal(
    tripMatchesActor({ driverId: "driver-1", busId: "bus-1" }, "driver-2", "bus-1"),
    false
  );
  assert.deepEqual(reminderOwner("passenger-1", "passenger-2"), {
    ok: false,
    status: 403,
  });
  assert.equal(roleHasPermission("business_admin", "routes:write"), true);
  assert.equal(roleHasPermission("business_admin", "trips:write"), true);
  assert.equal(roleHasPermission("business_viewer", "routes:write"), false);
  assert.equal(roleHasPermission("business_viewer", "trips:write"), false);
  assert.equal(roleHasPermission("super_admin", "drivers:write"), true);
});
