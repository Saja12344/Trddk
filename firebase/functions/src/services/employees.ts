import type { AccountStatus, BusinessMembership, MembershipRole } from "@tardadi/shared";
import { COLLECTIONS, requireSaudiMobile } from "@tardadi/shared";
import { admin, db } from "../firebase";
import { upsertMembership, storeBeneficiaryPhone } from "./users";

export interface BusinessEmployeeRecord {
  uid: string;
  email: string;
  phone: string | null;
  displayName: string;
  status: AccountStatus;
  membership: BusinessMembership;
  roleLabel: string;
  driverId: string | null;
  driverName: string | null;
  hasPassword: boolean;
  joinedAt: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function employeeRoleLabel(m: BusinessMembership): string {
  const hasPassenger =
    m.passengerAccess === true ||
    (m.passengerAccess !== false && m.role === "employee");
  const hasDriver = m.driverAccess === true || m.role === "driver";
  if (hasPassenger && hasDriver) return "both";
  if (hasDriver) return "driver";
  if (hasPassenger) return "passenger";
  return m.role;
}

export async function listBusinessEmployees(
  businessId: string
): Promise<BusinessEmployeeRecord[]> {
  const membershipsSnap = await db.collectionGroup(COLLECTIONS.memberships).get();
  const employees: BusinessEmployeeRecord[] = [];

  for (const membershipDoc of membershipsSnap.docs) {
    if (membershipDoc.id !== businessId) continue;
    const uid = membershipDoc.ref.parent.parent?.id;
    if (!uid) continue;

    const membership = {
      businessId,
      ...(membershipDoc.data() as Omit<BusinessMembership, "businessId">),
    } as BusinessMembership;

    if (membership.status === "revoked") continue;
    // Panel roles belong in company manager — not the beneficiaries employee list.
    if (
      membership.role === "business_admin" ||
      membership.role === "business_viewer"
    ) {
      continue;
    }

    const userDoc = await db.collection(COLLECTIONS.users).doc(uid).get();
    if (!userDoc.exists) continue;

    const userData = userDoc.data()!;
    let driverName: string | null = null;
    const driverId = membership.driverId ?? null;
    if (driverId) {
      const driverDoc = await db
        .collection(COLLECTIONS.businesses)
        .doc(businessId)
        .collection(COLLECTIONS.drivers)
        .doc(driverId)
        .get();
      if (driverDoc.exists) {
        driverName = (driverDoc.data()?.name as string) ?? null;
      }
    }

    let hasPassword = userData.hasPassword === true;
    if (!hasPassword) {
      try {
        const authUser = await admin.auth().getUser(uid);
        hasPassword = authUser.providerData.some(
          (p) => p.providerId === "password"
        );
      } catch {
        hasPassword = false;
      }
    }

    employees.push({
      uid,
      email: (userData.email as string) ?? "",
      phone:
        (userData.phone as string | undefined) ??
        (membership.phone as string | undefined) ??
        null,
      displayName: userData.displayName as string,
      status: (userData.status as AccountStatus) ?? "pending",
      membership,
      roleLabel: employeeRoleLabel(membership),
      driverId,
      driverName,
      hasPassword,
      joinedAt: membership.joinedAt ?? null,
    });
  }

  return employees.sort((a, b) =>
    (a.displayName || a.email).localeCompare(b.displayName || b.email)
  );
}

export async function updateEmployeeMembership(
  businessId: string,
  uid: string,
  patch: {
    displayName?: string;
    phone?: string;
    passengerAccess?: boolean;
    driverAccess?: boolean;
    status?: AccountStatus;
    membershipStatus?: AccountStatus;
  }
): Promise<void> {
  if (patch.displayName) {
    await db.collection(COLLECTIONS.users).doc(uid).set(
      { displayName: patch.displayName, updatedAt: nowIso() },
      { merge: true }
    );
    try {
      await admin.auth().updateUser(uid, { displayName: patch.displayName });
    } catch {
      /* ignore */
    }
  }

  if (patch.status) {
    await db.collection(COLLECTIONS.users).doc(uid).set(
      { status: patch.status, updatedAt: nowIso() },
      { merge: true }
    );
    if (patch.status === "suspended" || patch.status === "revoked") {
      try {
        await admin.auth().updateUser(uid, { disabled: true });
      } catch {
        /* ignore */
      }
    }
  }

  const membershipRef = db
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(COLLECTIONS.memberships)
    .doc(businessId);
  const membershipDoc = await membershipRef.get();
  if (!membershipDoc.exists) {
    throw new Error("Employee not found in this company.");
  }

  if (patch.phone?.trim()) {
    await storeBeneficiaryPhone(uid, patch.phone, businessId);
  }

  const current = membershipDoc.data() as Omit<BusinessMembership, "businessId">;
  const passengerAccess = patch.passengerAccess ?? current.passengerAccess;
  const driverAccess = patch.driverAccess ?? current.driverAccess;
  let role: MembershipRole = current.role;
  if (driverAccess && passengerAccess === false) role = "driver";
  else if (passengerAccess !== false) role = "employee";

  await upsertMembership(uid, businessId, {
    ...current,
    role,
    passengerAccess,
    driverAccess,
    ...(patch.phone?.trim() ? { phone: requireSaudiMobile(patch.phone) } : {}),
    status: patch.membershipStatus ?? current.status,
  });
}

export async function removeEmployeeFromBusiness(
  businessId: string,
  uid: string
): Promise<void> {
  const membershipRef = db
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(COLLECTIONS.memberships)
    .doc(businessId);
  const membershipDoc = await membershipRef.get();
  if (!membershipDoc.exists) return;

  const data = membershipDoc.data() as Omit<BusinessMembership, "businessId">;
  await upsertMembership(uid, businessId, {
    ...data,
    status: "revoked",
    driverAccess: false,
    passengerAccess: false,
  });

  if (data.driverId) {
    await db
      .collection(COLLECTIONS.businesses)
      .doc(businessId)
      .collection(COLLECTIONS.drivers)
      .doc(data.driverId)
      .set(
        {
          status: "inactive",
          assignedRouteId: null,
          assignedBusId: null,
          updatedAt: nowIso(),
        },
        { merge: true }
      );
  }
}
