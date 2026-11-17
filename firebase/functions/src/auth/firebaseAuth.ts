import type {
  AccountStatus,
  AuthenticatedUser,
  BusinessMembership,
  PrimaryRole,
} from "@tardadi/shared";
import { COLLECTIONS } from "@tardadi/shared";
import { admin, db } from "../firebase";

const ACTIVE_STATUSES: AccountStatus[] = ["active", "pending"];

export async function verifyFirebaseIdToken(
  idToken: string
): Promise<admin.auth.DecodedIdToken | null> {
  try {
    return await admin.auth().verifyIdToken(idToken, true);
  } catch {
    return null;
  }
}

function mapMembership(
  businessId: string,
  data: FirebaseFirestore.DocumentData
): BusinessMembership {
  return {
    businessId,
    role: data.role as BusinessMembership["role"],
    status: (data.status as AccountStatus) ?? "active",
    joinedAt: data.joinedAt as string | undefined,
    source: data.source as BusinessMembership["source"],
    invitedBy: (data.invitedBy as string | null) ?? null,
    employeeId: (data.employeeId as string | null) ?? null,
    driverId: (data.driverId as string | null) ?? null,
    department: (data.department as string | null) ?? null,
    employeeNumber: (data.employeeNumber as string | null) ?? null,
    passengerAccess: data.passengerAccess as boolean | undefined,
    driverAccess: data.driverAccess as boolean | undefined,
  };
}

export async function loadAuthenticatedUser(
  uid: string
): Promise<AuthenticatedUser | null> {
  const userDoc = await db.collection(COLLECTIONS.users).doc(uid).get();
  if (!userDoc.exists) {
    return null;
  }

  const data = userDoc.data()!;
  const status = (data.status as AccountStatus) ?? "pending";
  if (!ACTIVE_STATUSES.includes(status)) {
    return null;
  }

  const membershipsSnap = await userDoc.ref.collection(COLLECTIONS.memberships).get();
  const memberships = membershipsSnap.docs
    .map((doc) => mapMembership(doc.id, doc.data()))
    .filter((m) => ACTIVE_STATUSES.includes(m.status));

  const allowedBusinessIds = memberships.map((m) => m.businessId);

  return {
    uid,
    email: (data.email as string) ?? "",
    displayName: (data.displayName as string) ?? "",
    primaryRole: data.primaryRole as PrimaryRole,
    status,
    memberships,
    allowedBusinessIds,
  };
}

export async function resolveUserFromIdToken(
  idToken: string
): Promise<AuthenticatedUser | null> {
  const decoded = await verifyFirebaseIdToken(idToken);
  if (!decoded?.uid) return null;

  const authUser = await admin.auth().getUser(decoded.uid);
  if (authUser.disabled) return null;

  return loadAuthenticatedUser(decoded.uid);
}

export async function syncCustomClaims(user: AuthenticatedUser): Promise<void> {
  const primaryMembership =
    user.memberships.find((m) => m.status === "active") ?? user.memberships[0];

  await admin.auth().setCustomUserClaims(user.uid, {
    role: user.primaryRole,
    businessId: primaryMembership?.businessId ?? null,
    status: user.status,
  });
}

export function primaryBusinessId(user: AuthenticatedUser): string | null {
  if (user.primaryRole === "business_admin" || user.primaryRole === "business_viewer") {
    const adminMembership = user.memberships.find(
      (m) =>
        m.status === "active" &&
        (m.role === "business_admin" || m.role === "business_viewer")
    );
    return adminMembership?.businessId ?? user.allowedBusinessIds[0] ?? null;
  }
  return user.allowedBusinessIds[0] ?? null;
}

export function assertBusinessAccess(
  user: AuthenticatedUser,
  businessId: string
): void {
  if (user.primaryRole === "super_admin" || user.primaryRole === "platform_admin") {
    return;
  }
  if (!user.allowedBusinessIds.includes(businessId)) {
    throw new Error("لا يمكنك الوصول لبيانات شركة أخرى.");
  }
}
