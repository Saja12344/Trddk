import type { AuthenticatedUser } from "@tardadi/shared";
import { normalizePhone } from "@tardadi/shared";
import { admin } from "../firebase";
import {
  loadAuthenticatedUser,
  verifyFirebaseIdToken,
} from "../auth/firebaseAuth";
import {
  loadDriverSessionByPhone,
  loadDriverSessionFromBusiness,
} from "./driverSession";

function driverMembership(user: AuthenticatedUser) {
  return user.memberships.find(
    (m) =>
      (m.status === "active" || m.status === "pending") &&
      (m.role === "driver" || m.driverAccess === true) &&
      Boolean(m.driverId)
  );
}

export function userMayUseDriverApp(user: AuthenticatedUser): boolean {
  return user.primaryRole === "driver" || driverMembership(user) != null;
}

export async function createDriverAppSession(user: AuthenticatedUser) {
  const membership = driverMembership(user);
  if (!membership?.driverId) {
    throw new Error("This account is not authorized for the driver app.");
  }

  return loadDriverSessionFromBusiness(membership.businessId, membership.driverId);
}

export async function createFirebaseAppSession(
  idToken: string,
  app: "driver" | "passenger"
) {
  const decoded = await verifyFirebaseIdToken(idToken);
  if (!decoded?.uid) {
    throw new Error("Invalid credentials.");
  }

  const authUser = await admin.auth().getUser(decoded.uid);
  if (authUser.disabled) {
    throw new Error("Invalid credentials.");
  }

  if (app === "driver") {
    const user = await loadAuthenticatedUser(decoded.uid);
    if (user && userMayUseDriverApp(user)) {
      return createDriverAppSession(user);
    }
    const phone = decoded.phone_number || authUser.phoneNumber;
    if (!phone) {
      throw new Error("Phone number is not registered. Contact your employer.");
    }
    return loadDriverSessionByPhone("demo-org", phone, normalizePhone);
  }

  if (app === "passenger") {
    const user = await loadAuthenticatedUser(decoded.uid);
    if (!user) {
      throw new Error("Invalid credentials.");
    }
    return { verified: true as const };
  }

  throw new Error("Invalid request.");
}
