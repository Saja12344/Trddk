import test from "node:test";
import assert from "node:assert/strict";
import {
  PASSENGER_REVIEW_USER_ID,
  STORE_REVIEW_BUSINESS_ID,
  STORE_REVIEW_DRIVER_ID,
  anonymizedIdentity,
  isReviewDriverIdentity,
  isReviewPassengerIdentity,
  planAccountDeletion,
} from "../dist/services/accountDeletion.js";

test("a normal driver account is planned for deletion", () => {
  const plan = planAccountDeletion({
    role: "driver",
    review: false,
    status: "active",
    displayName: "Sara Ali",
    phone: "+966512345678",
  });
  assert.equal(plan.action, "delete");
  if (plan.action !== "delete") return;
  assert.equal(plan.role, "driver");
  assert.equal(plan.displayName, "Sara Ali");
  assert.equal(plan.phoneLast4, "5678");
  assert.equal(plan.phoneHash?.length, 64);
  const stored = anonymizedIdentity("2026-11-20T00:00:00.000Z", plan.phoneHash);
  assert.equal(stored.phone, null);
  assert.equal(stored.name, null);
  assert.equal(stored.status, "deleted");
  assert.equal(stored.deletedBy, "self");
  assert.equal(stored.phoneHash, plan.phoneHash);
});

test("a business passenger account is planned for deletion", () => {
  const plan = planAccountDeletion({
    role: "passenger",
    review: false,
    status: "active",
    displayName: "Noura",
    phone: "0550001122",
  });
  assert.equal(plan.action, "delete");
  if (plan.action !== "delete") return;
  assert.equal(plan.role, "passenger");
  assert.equal(plan.phoneLast4, "1122");
});

test("review accounts are a no-op", () => {
  assert.equal(
    isReviewDriverIdentity(STORE_REVIEW_DRIVER_ID, "any-company"),
    true
  );
  assert.equal(
    isReviewDriverIdentity("driver-1", STORE_REVIEW_BUSINESS_ID),
    true
  );
  assert.equal(isReviewPassengerIdentity(PASSENGER_REVIEW_USER_ID, null), true);
  assert.equal(isReviewPassengerIdentity("uid-1", "+966500300001"), true);
  assert.equal(
    planAccountDeletion({
      role: "driver",
      review: true,
      status: "active",
      displayName: "Store review",
      phone: "+966500300002",
    }).action,
    "review_noop"
  );
  assert.equal(
    planAccountDeletion({
      role: "passenger",
      review: true,
      status: "active",
      phone: "+966500300001",
    }).action,
    "review_noop"
  );
});

test("deleting an already deleted account is idempotent", () => {
  assert.equal(
    planAccountDeletion({
      role: "driver",
      review: false,
      status: "deleted",
      displayName: null,
      phone: null,
    }).action,
    "already_deleted"
  );
  assert.equal(
    planAccountDeletion({
      role: "passenger",
      review: false,
      status: "deleted",
      displayName: "Noura",
      phone: "+966500000000",
    }).action,
    "already_deleted"
  );
});
