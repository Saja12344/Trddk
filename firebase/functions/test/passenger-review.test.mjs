import test from "node:test";
import assert from "node:assert/strict";
import { isAdminPanelRole } from "@tardadi/shared";
import {
  expectedReviewOtp,
  isPassengerReviewAuthorization,
  isStoreReviewPhone,
  omitReviewPrivateFields,
  reviewLoginDecision,
  signPassengerReviewToken,
  STORE_REVIEW_PHONE,
} from "../dist/services/passengerReview.js";
import { verifyJwt, getJwtSecret } from "../dist/auth/crypto.js";
import { sendSms } from "../dist/auth/sms.js";

const REVIEW_CODE = "84729163";

test("review phone normalizes to the store number only", () => {
  assert.equal(isStoreReviewPhone("+966500300001"), true);
  assert.equal(isStoreReviewPhone("500300001"), true);
  assert.equal(isStoreReviewPhone("0500300001"), true);
  assert.equal(isStoreReviewPhone("+966500000000"), false);
  assert.equal(isStoreReviewPhone("+966511111111"), false);
});

test("fixed review code is accepted only for the review phone", () => {
  assert.equal(expectedReviewOtp(), REVIEW_CODE);
  const ok = reviewLoginDecision(STORE_REVIEW_PHONE, REVIEW_CODE);
  assert.equal(ok.ok, true);
  assert.equal(ok.phone, STORE_REVIEW_PHONE);

  assert.equal(reviewLoginDecision("0500300001", ` ${REVIEW_CODE} `).ok, true);
  assert.equal(reviewLoginDecision(STORE_REVIEW_PHONE, "00000000").ok, false);
  assert.equal(reviewLoginDecision(STORE_REVIEW_PHONE, "847291").ok, false);
  assert.equal(reviewLoginDecision("+966511111111", REVIEW_CODE).ok, false);
  assert.equal(reviewLoginDecision("+966500000000", REVIEW_CODE).ok, false);
  assert.equal(reviewLoginDecision("not-a-phone", REVIEW_CODE).ok, false);
});

test("review session is not an admin or business session", () => {
  const token = signPassengerReviewToken(STORE_REVIEW_PHONE);
  const payload = verifyJwt(token, getJwtSecret());
  assert.equal(payload.role, "passenger_review");
  assert.equal(payload.businessId, null);
  assert.equal(payload.sub, "passenger-store-review");
  assert.equal(isAdminPanelRole(payload.role), false);
  assert.equal(
    isPassengerReviewAuthorization(`Bearer ${token}`),
    true
  );
  assert.equal(isPassengerReviewAuthorization("Bearer not-a-token"), false);
});

test("review responses drop phone and email fields", () => {
  const cleaned = omitReviewPrivateFields({
    busId: "bus-1",
    latitude: 24.7,
    phone: "+966500000000",
    email: "driver@example.com",
    driverPhone: "+966511111111",
  });
  assert.equal(cleaned.busId, "bus-1");
  assert.equal(cleaned.latitude, 24.7);
  assert.equal("phone" in cleaned, false);
  assert.equal("email" in cleaned, false);
  assert.equal("driverPhone" in cleaned, false);
});

test("sendSms does not call a provider for the review phone", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("ok", { status: 200 });
  };
  const previousKey = process.env.TAQNYAT_API_KEY;
  process.env.TAQNYAT_API_KEY = "test-key-not-used";
  try {
    await assert.rejects(
      () => sendSms(STORE_REVIEW_PHONE, `رمز ${REVIEW_CODE}`),
      /تعذّر إرسال رمز التحقق/
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.TAQNYAT_API_KEY;
    else process.env.TAQNYAT_API_KEY = previousKey;
  }
});

test("sendSms still reaches the provider for any other phone", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  let body = "";
  globalThis.fetch = async (_url, init) => {
    called = true;
    body = String(init?.body ?? "");
    return new Response("ok", { status: 200 });
  };
  const previousKey = process.env.TAQNYAT_API_KEY;
  process.env.TAQNYAT_API_KEY = "test-key";
  try {
    await sendSms("+966511111111", "رمز دخول آخر");
    assert.equal(called, true);
    assert.match(body, /966511111111/);
    assert.doesNotMatch(body, /500300001/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.TAQNYAT_API_KEY;
    else process.env.TAQNYAT_API_KEY = previousKey;
  }
});
