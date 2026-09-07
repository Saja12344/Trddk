import type { AuthenticatedUser } from "@tardadi/shared";
import { resolveUserFromIdToken } from "../auth/firebaseAuth";
import { loadDriverSessionFromBusiness } from "./driverSession";

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
  const user = await resolveUserFromIdToken(idToken);
  if (!user) {
    throw new Error("Invalid credentials.");
  }

  if (app === "driver") {
    if (!userMayUseDriverApp(user)) {
      throw new Error("This account is not authorized for the driver app.");
    }
    return createDriverAppSession(user);
  }

  if (app === "passenger") {
    return { verified: true as const };
  }

  throw new Error("Invalid request.");
}
