import type { AccountStatus, BusinessMembership, TrddkUser } from "@tardadi/shared";
import { COLLECTIONS } from "@tardadi/shared";
import { admin, db } from "../firebase";
import { getJwtSecret, signJwt, verifyJwt } from "../auth/crypto";
import { loadAuthenticatedUser } from "../auth/firebaseAuth";
import { getUserByEmail, normalizeEmail } from "./users";
import { membershipAllowsPassenger, resolvesPassengerAccess } from "./passengerAccess";

export { membershipAllowsPassenger, resolvesPassengerAccess };

export interface PassengerMembershipSummary {
  businessId: string;
  businessName: string;
  passengerAccess: boolean;
  driverAccess: boolean;
  status: AccountStatus;
}

export interface PassengerSessionPayload {
  sub: string;
  email: string;
  businessId: string;
  iat: number;
  exp: number;
}

const VERIFICATION_TTL_SEC = 10 * 60;
const SESSION_TTL_SEC = 7 * 24 * 60 * 60;

export function signPassengerVerificationToken(email: string, uid: string): string {
  return signJwt(
    {
      sub: uid,
      role: "passenger_verify",
      businessId: normalizeEmail(email),
      name: uid,
      phone: normalizeEmail(email),
    },
    getJwtSecret(),
    VERIFICATION_TTL_SEC
  );
}

export function signPassengerSessionToken(
  uid: string,
  email: string,
  businessId: string
): string {
  return signJwt(
    {
      sub: uid,
      role: "passenger_session",
      businessId,
      name: email,
      phone: email,
    },
    getJwtSecret(),
    SESSION_TTL_SEC
  );
}

export function parsePassengerSessionToken(
  token: string
): PassengerSessionPayload | null {
  const payload = verifyJwt(token, getJwtSecret());
  if (!payload || payload.role !== "passenger_session") return null;
  return {
    sub: payload.sub,
    email: payload.phone,
    businessId: payload.businessId ?? "",
    iat: payload.iat,
    exp: payload.exp,
  };
}

export function parsePassengerVerificationToken(
  token: string
): { uid: string; email: string } | null {
  const payload = verifyJwt(token, getJwtSecret());
  if (!payload || payload.role !== "passenger_verify") return null;
  return { uid: payload.sub, email: payload.phone };
}

export async function resolvePassengerUserByEmail(
  email: string
): Promise<TrddkUser | null> {
  const normalized = normalizeEmail(email);
  const fromFirestore = await getUserByEmail(normalized);
  if (fromFirestore) return fromFirestore;

  try {
    const authUser = await admin.auth().getUserByEmail(normalized);
    const userRef = db.collection(COLLECTIONS.users).doc(authUser.uid);
    const snap = await userRef.get();
    if (!snap.exists) return null;

    const data = snap.data()!;
    if ((data.email as string | undefined)?.toLowerCase() !== normalized) {
      await userRef.set({ email: normalized, updatedAt: new Date().toISOString() }, { merge: true });
    }

    return {
      uid: authUser.uid,
      email: normalized,
      displayName: (data.displayName as string) ?? authUser.displayName ?? normalized,
      primaryRole: data.primaryRole as TrddkUser["primaryRole"],
      status: data.status as AccountStatus,
      createdAt: data.createdAt as string | undefined,
      createdBy: (data.createdBy as string | null) ?? null,
      lastLoginAt: (data.lastLoginAt as string | null) ?? null,
      legacyAdminUserId: (data.legacyAdminUserId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

async function passengerUidForEmail(email: string): Promise<string | null> {
  const user = await resolvePassengerUserByEmail(email);
  return user?.uid ?? null;
}

export async function activatePassengerAccess(
  uid: string,
  businessIds: string[]
): Promise<void> {
  const now = new Date().toISOString();
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    const status = userSnap.data()?.status as AccountStatus | undefined;
    if (status === "pending") {
      await userRef.update({ status: "active", updatedAt: now });
    }
  }

  for (const businessId of businessIds) {
    const membershipRef = userRef.collection(COLLECTIONS.memberships).doc(businessId);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) continue;
    const membershipStatus = membershipSnap.data()?.status as AccountStatus | undefined;
    if (membershipStatus === "pending") {
      await membershipRef.update({ status: "active", joinedAt: now });
    }
  }
}

export async function listPassengerMemberships(
  email: string
): Promise<PassengerMembershipSummary[]> {
  const normalized = normalizeEmail(email);
  const uid = await passengerUidForEmail(normalized);
  if (!uid) return [];
  const membershipsSnap = await db
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(COLLECTIONS.memberships)
    .get();

  const summaries: PassengerMembershipSummary[] = [];
  for (const doc of membershipsSnap.docs) {
    const data = doc.data() as Omit<BusinessMembership, "businessId">;
    const membership: BusinessMembership = {
      businessId: doc.id,
      ...data,
      passengerAccess:
        data.passengerAccess === true
          ? true
          : data.passengerAccess === false
            ? false
            : data.role === "employee",
      driverAccess: data.driverAccess ?? data.role === "driver",
    };
    if (!membershipAllowsPassenger(membership)) continue;

    const businessDoc = await db
      .collection(COLLECTIONS.businesses)
      .doc(doc.id)
      .get();
    if (!businessDoc.exists) continue;
    if ((businessDoc.data()?.status as string | undefined) === "inactive") {
      continue;
    }

    summaries.push({
      businessId: doc.id,
      businessName: (businessDoc.data()?.name as string) ?? doc.id,
      passengerAccess: resolvesPassengerAccess(membership),
      driverAccess: membership.driverAccess === true,
      status: membership.status,
    });
  }

  return summaries;
}

export async function assertPassengerBusinessAccess(
  uid: string,
  businessId: string
): Promise<BusinessMembership> {
  const membershipDoc = await db
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(COLLECTIONS.memberships)
    .doc(businessId)
    .get();

  if (!membershipDoc.exists) {
    throw new Error("Access denied.");
  }

  const data = membershipDoc.data() as Omit<BusinessMembership, "businessId">;
  const membership: BusinessMembership = {
    businessId,
    ...data,
    passengerAccess:
      data.passengerAccess === true
        ? true
        : data.passengerAccess === false
          ? false
          : data.role === "employee",
    driverAccess: data.driverAccess ?? data.role === "driver",
  };

  if (membership.status !== "active" && membership.status !== "pending") {
    throw new Error("Access denied.");
  }
  if (!membershipAllowsPassenger(membership)) {
    throw new Error("Access denied.");
  }

  const user = await loadAuthenticatedUser(uid);
  if (!user || user.status === "suspended" || user.status === "revoked") {
    throw new Error("Access denied.");
  }

  return membership;
}
