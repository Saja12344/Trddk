import type { AccountStatus, BusinessMembership, MembershipRole, PrimaryRole } from "@tardadi/shared";
import { COLLECTIONS, requireSaudiMobile } from "@tardadi/shared";
import { loadAuthenticatedUser, syncCustomClaims } from "../auth/firebaseAuth";
import { admin, db } from "../firebase";
import { normalizeEmail, storeBeneficiaryPhone, upsertMembership } from "./users";

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
    // View-only panel accounts stay on the company page.
    if (membership.role === "business_viewer") continue;

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

async function ensureDriverRecord(
  businessId: string,
  driverId: string | null,
  name: string,
  phone: string
): Promise<string> {
  const drivers = db
    .collection(COLLECTIONS.businesses)
    .doc(businessId)
    .collection(COLLECTIONS.drivers);
  const now = nowIso();
  const payload = {
    name: name || phone,
    phone,
    status: "active",
    updatedAt: now,
  };

  if (driverId) {
    const existing = await drivers.doc(driverId).get();
    if (existing.exists) {
      await existing.ref.set(payload, { merge: true });
      return driverId;
    }
  }

  const byPhone = await drivers.where("phone", "==", phone).limit(1).get();
  if (!byPhone.empty) {
    await byPhone.docs[0].ref.set(payload, { merge: true });
    return byPhone.docs[0].id;
  }

  const created = await drivers.add({
    ...payload,
    driverCode: null,
    assignedRouteId: null,
    assignedBusId: null,
    createdAt: now,
  });
  return created.id;
}

async function deactivateDriverRecord(
  businessId: string,
  driverId: string
): Promise<void> {
  await db
    .collection(COLLECTIONS.businesses)
    .doc(businessId)
    .collection(COLLECTIONS.drivers)
    .doc(driverId)
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

export async function updateEmployeeMembership(
  businessId: string,
  uid: string,
  patch: {
    displayName?: string;
    phone?: string;
    email?: string;
    appRole?: "passenger" | "driver" | "admin";
    passengerAccess?: boolean;
    driverAccess?: boolean;
    status?: AccountStatus;
    membershipStatus?: AccountStatus;
  }
): Promise<{ driverId: string | null }> {
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
    try {
      if (patch.status === "suspended" || patch.status === "revoked") {
        await admin.auth().updateUser(uid, { disabled: true });
      } else if (patch.status === "active") {
        await admin.auth().updateUser(uid, { disabled: false });
      }
    } catch {
      /* ignore */
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

  if (patch.email?.trim()) {
    const email = normalizeEmail(patch.email);
    await db.collection(COLLECTIONS.users).doc(uid).set(
      { email, updatedAt: nowIso() },
      { merge: true }
    );
    try {
      await admin.auth().updateUser(uid, { email });
    } catch {
      /* phone-only accounts may not accept an email update */
    }
  }

  if (patch.phone?.trim()) {
    await storeBeneficiaryPhone(uid, patch.phone, businessId);
  }

  const current = membershipDoc.data() as Omit<BusinessMembership, "businessId">;
  const userData = (await db.collection(COLLECTIONS.users).doc(uid).get()).data();
  let passengerAccess = patch.passengerAccess ?? current.passengerAccess;
  let driverAccess = patch.driverAccess ?? current.driverAccess;
  let role: MembershipRole = current.role;
  let driverId = current.driverId ?? null;
  const phone = patch.phone?.trim()
    ? requireSaudiMobile(patch.phone)
    : ((userData?.phone as string | undefined) ??
      (current.phone as string | undefined) ??
      "");
  const name =
    patch.displayName?.trim() ||
    (userData?.displayName as string | undefined) ||
    phone;

  if (patch.appRole === "passenger") {
    role = "employee";
    passengerAccess = true;
    driverAccess = false;
  } else if (patch.appRole === "driver") {
    if (!phone) throw new Error("رقم الجوال مطلوب للسائق.");
    role = "driver";
    passengerAccess = false;
    driverAccess = true;
  } else if (patch.appRole === "admin") {
    role = "business_admin";
    passengerAccess = false;
    driverAccess = false;
  } else if (driverAccess && passengerAccess === false) {
    role = "driver";
  } else if (passengerAccess !== false && role !== "business_admin") {
    role = "employee";
  }

  if (patch.appRole === "driver") {
    driverId = await ensureDriverRecord(businessId, driverId, name, phone);
  } else if (patch.phone?.trim() && driverId && role === "driver") {
    driverId = await ensureDriverRecord(businessId, driverId, name, phone);
  } else if (
    (patch.appRole === "passenger" || patch.appRole === "admin") &&
    driverId
  ) {
    await deactivateDriverRecord(businessId, driverId);
  }

  if (driverId && patch.status === "suspended") {
    await db
      .collection(COLLECTIONS.businesses)
      .doc(businessId)
      .collection(COLLECTIONS.drivers)
      .doc(driverId)
      .set({ status: "inactive", updatedAt: nowIso() }, { merge: true });
  } else if (driverId && patch.status === "active" && role === "driver") {
    await db
      .collection(COLLECTIONS.businesses)
      .doc(businessId)
      .collection(COLLECTIONS.drivers)
      .doc(driverId)
      .set({ status: "active", updatedAt: nowIso() }, { merge: true });
  }

  const currentPrimary = userData?.primaryRole as PrimaryRole | undefined;
  const protectedPrimary =
    currentPrimary === "super_admin" || currentPrimary === "platform_admin";
  if (!protectedPrimary) {
    const nextPrimary: PrimaryRole =
      role === "business_admin"
        ? "business_admin"
        : role === "driver"
          ? "driver"
          : "employee";
    if (currentPrimary !== nextPrimary) {
      await db.collection(COLLECTIONS.users).doc(uid).set(
        { primaryRole: nextPrimary, updatedAt: nowIso() },
        { merge: true }
      );
    }
  }

  await upsertMembership(uid, businessId, {
    ...current,
    role,
    passengerAccess,
    driverAccess,
    driverId,
    ...(phone ? { phone } : {}),
    status: patch.membershipStatus ?? current.status,
  });

  const loaded = await loadAuthenticatedUser(uid);
  if (loaded) {
    await syncCustomClaims(loaded);
  }

  return { driverId };
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
