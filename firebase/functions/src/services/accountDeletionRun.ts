import { COLLECTIONS } from "@tardadi/shared";
import { admin, db } from "../firebase";
import { businessRef } from "../business/helpers";
import { finalizeTrip } from "../jobs/closeStaleTrips";
import { removeEmployeeFromBusiness } from "./employees";
import { findFirestoreUsersByPhone } from "./users";
import {
  ADMIN_NOTIFICATIONS,
  anonymizedIdentity,
  planAccountDeletion,
  type AccountDeletionPlan,
} from "./accountDeletion";

export interface DeleteAccountResult {
  deleted: boolean;
  review: boolean;
}

async function deleteAuthUser(uid: string): Promise<void> {
  try {
    await admin.auth().deleteUser(uid);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "auth/user-not-found") throw error;
  }
}

async function notifyBusiness(input: {
  businessId: string;
  role: "driver" | "passenger";
  displayName: string;
  phoneLast4: string;
  createdAt: string;
}): Promise<void> {
  if (!input.businessId || input.businessId === "store-review") return;
  await businessRef(db, input.businessId).collection(ADMIN_NOTIFICATIONS).add({
    type: "account_deleted",
    role: input.role,
    businessId: input.businessId,
    displayName: input.displayName,
    phoneLast4: input.phoneLast4,
    createdAt: input.createdAt,
    read: false,
  });
}

async function closeOpenTrips(businessId: string, driverId: string, endedAt: string) {
  const trips = await businessRef(db, businessId)
    .collection(COLLECTIONS.trips)
    .where("tripStatus", "==", "active")
    .get();
  for (const trip of trips.docs) {
    if (trip.data().driverId !== driverId) continue;
    await finalizeTrip({
      businessId,
      tripId: trip.id,
      endedAt,
      endReason: "driver_account_deleted",
    });
  }
}

async function linkedUserIds(phone: string | null): Promise<string[]> {
  if (!phone?.trim()) return [];
  const users = await findFirestoreUsersByPhone(phone);
  return users.map((user) => user.uid);
}

async function anonymizeUser(uid: string, plan: Extract<AccountDeletionPlan, { action: "delete" }>, now: string) {
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const memberships = await userRef.collection(COLLECTIONS.memberships).get();
  const businessIds = memberships.docs.map((doc) => doc.id);
  for (const businessId of businessIds) {
    await removeEmployeeFromBusiness(businessId, uid);
  }
  await userRef.set(anonymizedIdentity(now, plan.phoneHash), { merge: true });
  await deleteAuthUser(uid);
  return businessIds;
}

export async function deleteDriverAccount(
  driverId: string,
  businessId: string
): Promise<DeleteAccountResult> {
  const ref = businessRef(db, businessId).collection(COLLECTIONS.drivers).doc(driverId);
  const snap = await ref.get();
  if (!snap.exists) return { deleted: false, review: false };

  const data = snap.data() ?? {};
  const phone = typeof data.phone === "string" ? data.phone : null;
  const name =
    (typeof data.name === "string" && data.name) ||
    (typeof data.nameAr === "string" && data.nameAr) ||
    (typeof data.nameEn === "string" && data.nameEn) ||
    null;
  const plan = planAccountDeletion({
    role: "driver",
    review: false,
    status: typeof data.status === "string" ? data.status : null,
    displayName: name,
    phone,
  });
  if (plan.action !== "delete") return { deleted: false, review: false };

  const now = new Date().toISOString();
  await closeOpenTrips(businessId, driverId, now);
  const userIds = await linkedUserIds(phone);
  const notified = new Set<string>();
  for (const uid of userIds) {
    const businesses = await anonymizeUser(uid, plan, now);
    for (const id of businesses) notified.add(id);
  }
  notified.add(businessId);

  await ref.set(
    {
      ...anonymizedIdentity(now, plan.phoneHash),
      assignedRouteId: null,
      assignedBusId: null,
    },
    { merge: true }
  );

  for (const id of notified) {
    await notifyBusiness({
      businessId: id,
      role: "driver",
      displayName: plan.displayName,
      phoneLast4: plan.phoneLast4,
      createdAt: now,
    });
  }
  return { deleted: true, review: false };
}

export async function deletePassengerAccount(
  uid: string,
  sessionBusinessId: string
): Promise<DeleteAccountResult> {
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) return { deleted: false, review: false };

  const data = snap.data() ?? {};
  const phone = typeof data.phone === "string" ? data.phone : null;
  const name =
    (typeof data.displayName === "string" && data.displayName) ||
    (typeof data.name === "string" && data.name) ||
    null;
  const plan = planAccountDeletion({
    role: "passenger",
    review: false,
    status: typeof data.status === "string" ? data.status : null,
    displayName: name,
    phone,
  });
  if (plan.action !== "delete") return { deleted: false, review: false };

  const now = new Date().toISOString();
  const businesses = await anonymizeUser(uid, plan, now);
  const notified = new Set(businesses);
  if (sessionBusinessId) notified.add(sessionBusinessId);
  for (const id of notified) {
    await notifyBusiness({
      businessId: id,
      role: "passenger",
      displayName: plan.displayName,
      phoneLast4: plan.phoneLast4,
      createdAt: now,
    });
  }
  return { deleted: true, review: false };
}
