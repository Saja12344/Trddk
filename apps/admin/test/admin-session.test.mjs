import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { sessionFromAdminCookie, usableAdminJwtSecret } from "./.generated/adminSessionToken.js";

const SECRET = "unit-test-jwt-secret-32chars-minimum!";

function sign(payload, secret = SECRET) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url"
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function cookie(token, user) {
  return JSON.stringify({
    token,
    user,
    authSource: "admin_mfa",
  });
}

const adminPayload = {
  sub: "admin-1",
  role: "business_admin",
  businessId: "biz-1",
  name: "Noura",
  phone: "admin@example.com",
  mfa: "1",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

test("admin cookie is accepted only with a signed MFA session", async () => {
  const token = sign(adminPayload);
  const forgedUser = cookie(token, {
    userId: "someone-else",
    role: "super_admin",
    businessId: "other-biz",
    mfaCompleted: true,
  });
  const session = await sessionFromAdminCookie(forgedUser, SECRET);
  assert.equal(session.user.userId, "admin-1");
  assert.equal(session.user.role, "business_admin");
  assert.equal(session.user.businessId, "biz-1");
});

test("flags alone do not open the admin session", async () => {
  const raw = JSON.stringify({
    authSource: "admin_mfa",
    user: { mfaCompleted: true, role: "super_admin" },
  });
  assert.equal(await sessionFromAdminCookie(raw, SECRET), null);
  assert.equal(await sessionFromAdminCookie(cookie(sign(adminPayload), {}), "short"), null);
  assert.equal(usableAdminJwtSecret("tardadi-dev-jwt-secret-change-in-production"), null);
});

test("driver and expired tokens do not open the admin session", async () => {
  const driver = sign({ ...adminPayload, role: "driver_session", mfa: undefined });
  assert.equal(await sessionFromAdminCookie(cookie(driver, {}), SECRET), null);
  const expired = sign({ ...adminPayload, exp: Math.floor(Date.now() / 1000) - 10 });
  assert.equal(await sessionFromAdminCookie(cookie(expired, {}), SECRET), null);
  const otherSecret = sign(adminPayload, "another-unit-test-secret-32chars!!");
  assert.equal(await sessionFromAdminCookie(cookie(otherSecret, {}), SECRET), null);
});
