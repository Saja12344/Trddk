import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { sessionFromAdminCookie, usableAdminJwtSecret, verifyAdminSessionToken } from "./.generated/adminSessionToken.js";
import {
  companyBusinessPathAllowed,
  scopedRequestBusinessId,
} from "./.generated/adminTenantScope.js";

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

test("a correctly signed MFA session is accepted", async () => {
  const claims = await verifyAdminSessionToken(sign(adminPayload), SECRET);
  assert.equal(claims.sub, "admin-1");
  assert.equal(claims.role, "business_admin");
  assert.equal(claims.mfa, "1");
  assert.equal(claims.businessId, "biz-1");
});

test("a signed payload is rejected after it is modified", async () => {
  const [header, , signature] = sign(adminPayload).split(".");
  const tampered = Buffer.from(
    JSON.stringify({ ...adminPayload, role: "super_admin", businessId: "other-biz" })
  ).toString("base64url");
  assert.equal(
    await verifyAdminSessionToken(`${header}.${tampered}.${signature}`, SECRET),
    null
  );
});

test("an unsigned token is rejected", async () => {
  const [header, body] = sign(adminPayload).split(".");
  assert.equal(await verifyAdminSessionToken(`${header}.${body}`, SECRET), null);
  assert.equal(await verifyAdminSessionToken(`${header}.${body}.`, SECRET), null);
  assert.equal(
    await verifyAdminSessionToken(`${header}.${body}.not-a-signature`, SECRET),
    null
  );
});

test("an expired token is rejected", async () => {
  const expired = sign({ ...adminPayload, exp: Math.floor(Date.now() / 1000) - 10 });
  assert.equal(await verifyAdminSessionToken(expired, SECRET), null);
});

test("a token signed with a different secret is rejected", async () => {
  const token = sign(adminPayload, "another-unit-test-secret-32chars!!");
  assert.equal(await verifyAdminSessionToken(token, SECRET), null);
});

test("a driver session token is rejected", async () => {
  const driver = sign({ ...adminPayload, role: "driver_session", mfa: "1" });
  assert.equal(await verifyAdminSessionToken(driver, SECRET), null);
});

test("a passenger or other disallowed role is rejected", async () => {
  const passenger = sign({ ...adminPayload, role: "passenger_session" });
  const employee = sign({ ...adminPayload, role: "employee" });
  assert.equal(await verifyAdminSessionToken(passenger, SECRET), null);
  assert.equal(await verifyAdminSessionToken(employee, SECRET), null);
});

test("MFA is required on the admin session token", async () => {
  const missing = sign({ ...adminPayload, mfa: undefined });
  const wrong = sign({ ...adminPayload, mfa: "0" });
  const challenge = sign({ ...adminPayload, role: "admin_mfa_challenge", mfa: "1" });
  assert.equal(await verifyAdminSessionToken(missing, SECRET), null);
  assert.equal(await verifyAdminSessionToken(wrong, SECRET), null);
  assert.equal(await verifyAdminSessionToken(challenge, SECRET), null);
});

test("company roles cannot choose another business from the client", () => {
  assert.deepEqual(
    scopedRequestBusinessId({
      role: "business_viewer",
      tokenBusinessId: "biz-1",
      contextBusinessId: "other-biz",
    }),
    { ok: true, businessId: "biz-1" }
  );
  assert.deepEqual(
    scopedRequestBusinessId({
      role: "business_admin",
      tokenBusinessId: null,
      contextBusinessId: "other-biz",
    }),
    { ok: false }
  );
  assert.equal(
    companyBusinessPathAllowed("business_admin", "biz-1", ["api", "businesses", "other-biz"]),
    false
  );
  assert.equal(
    companyBusinessPathAllowed("business_viewer", "biz-1", ["api", "businesses"]),
    false
  );
  assert.equal(
    companyBusinessPathAllowed("business_admin", "biz-1", ["api", "businesses", "biz-1", "employees"]),
    true
  );
  assert.equal(
    companyBusinessPathAllowed("super_admin", null, ["api", "businesses"]),
    true
  );
});
