import test from "node:test";
import assert from "node:assert/strict";
import { isAdminPanelRole } from "@tardadi/shared";
import { verifyJwt, getJwtSecret } from "../dist/auth/crypto.js";
import { DRIVER_SESSION_ROLE } from "../dist/auth/driverAccess.js";
import {
  driverReviewLoginDecision,
  driverReviewSession,
  expectedDriverReviewOtp,
  isDriverStoreReviewPhone,
  STORE_DRIVER_REVIEW_PHONE,
} from "../dist/services/driverReview.js";

process.env.ADMIN_JWT_SECRET ??= "unit-test-jwt-secret-32chars-minimum!";

const REVIEW_CODE = "84729164";

test("driver review phone is not the passenger review phone", () => {
  assert.equal(isDriverStoreReviewPhone("+966500300002"), true);
  assert.equal(isDriverStoreReviewPhone("0500300002"), true);
  assert.equal(isDriverStoreReviewPhone("+966500300001"), false);
  assert.equal(isDriverStoreReviewPhone("+966511111111"), false);
});

test("driver review code is accepted only for the driver review phone", () => {
  delete process.env.DRIVER_REVIEW_OTP;
  assert.equal(expectedDriverReviewOtp(), REVIEW_CODE);
  const ok = driverReviewLoginDecision("500300002", ` ${REVIEW_CODE} `);
  assert.equal(ok.ok, true);
  assert.equal(ok.phone, STORE_DRIVER_REVIEW_PHONE);
  assert.equal(driverReviewLoginDecision(STORE_DRIVER_REVIEW_PHONE, "84729163").ok, false);
  assert.equal(driverReviewLoginDecision("+966500300001", REVIEW_CODE).ok, false);
  assert.equal(driverReviewLoginDecision("+966511111111", REVIEW_CODE).ok, false);
});

test("driver review session is a driver session and not an admin session", () => {
  const session = driverReviewSession(STORE_DRIVER_REVIEW_PHONE);
  assert.equal(session.driver.driverId, "store-review-driver");
  assert.equal(session.driver.businessId, "store-review");
  assert.equal(session.tripId, null);
  const payload = verifyJwt(session.sessionToken, getJwtSecret());
  assert.equal(payload?.role, DRIVER_SESSION_ROLE);
  assert.equal(payload?.sub, "store-review-driver");
  assert.equal(isAdminPanelRole(payload?.role ?? ""), false);
});
