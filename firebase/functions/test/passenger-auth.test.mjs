import test from "node:test";
import assert from "node:assert/strict";
import {
  membershipAllowsPassenger,
  resolvesPassengerAccess,
} from "../dist/services/passengerAccess.js";
import { shouldThrottleOtpResend } from "../dist/services/passengerOtp.js";

function membership(overrides) {
  return {
    businessId: "biz-1",
    role: "employee",
    status: "active",
    joinedAt: "2026-01-01T00:00:00.000Z",
    source: "invite",
    invitedBy: "admin",
    employeeNumber: null,
    department: null,
    driverId: null,
    ...overrides,
  };
}

test("admin membership with passengerAccess true is authorized", () => {
  const m = membership({
    role: "business_admin",
    passengerAccess: true,
  });
  assert.equal(resolvesPassengerAccess(m), true);
  assert.equal(membershipAllowsPassenger(m), true);
});

test("admin membership with passengerAccess false stays blocked", () => {
  const m = membership({
    role: "business_admin",
    passengerAccess: false,
  });
  assert.equal(resolvesPassengerAccess(m), false);
  assert.equal(membershipAllowsPassenger(m), false);
});

test("legacy employee without explicit passengerAccess remains authorized", () => {
  const m = membership({ role: "employee", passengerAccess: undefined });
  assert.equal(membershipAllowsPassenger(m), true);
});

test("revoked membership stays blocked even with passengerAccess true", () => {
  const m = membership({ status: "revoked", passengerAccess: true });
  assert.equal(membershipAllowsPassenger(m), false);
});

test("OTP resend cooldown blocks duplicate sends within 60 seconds", () => {
  const now = 1_000_000;
  assert.equal(shouldThrottleOtpResend(now - 30_000, now), true);
  assert.equal(shouldThrottleOtpResend(now - 61_000, now), false);
  assert.equal(shouldThrottleOtpResend(undefined, now), false);
});

test("OTP countdown expiry alone does not imply resend allowed under cooldown", () => {
  const otpSentAt = 0;
  const tenMinutesLater = 10 * 60 * 1000;
  assert.equal(shouldThrottleOtpResend(otpSentAt, tenMinutesLater), false);
});

test("duplicate OTP requests inside cooldown are throttled", () => {
  const sentAt = 5_000;
  const duplicateAt = sentAt + 15_000;
  assert.equal(shouldThrottleOtpResend(sentAt, duplicateAt), true);
});

test("explicit resend after cooldown is allowed", () => {
  const sentAt = 5_000;
  const resendAt = sentAt + 61_000;
  assert.equal(shouldThrottleOtpResend(sentAt, resendAt), false);
});
