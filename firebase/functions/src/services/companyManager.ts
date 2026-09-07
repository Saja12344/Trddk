import type { AccountStatus, BusinessMembership, ManagerInvitationStatus } from "@tardadi/shared";
import { COLLECTIONS } from "@tardadi/shared";
import { admin, db } from "../firebase";
import { syncCustomClaims, loadAuthenticatedUser } from "../auth/firebaseAuth";
import {
  createOrLinkUser,
  getUserByEmail,
  normalizeEmail,
  sendPasswordSetupLink,
  upsertMembership,
  userHasPassword,
} from "./users";

function nowIso(): string {
  return new Date().toISOString();
}

export async function loadCompanyManagerSummary(
  businessId: string,
  businessData: FirebaseFirestore.DocumentData
): Promise<{
  uid: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: "business_admin";
  accountStatus: AccountStatus | "incomplete";
  invitationStatus: ManagerInvitationStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  incompleteReason: string | null;
}> {
  const managerUid = (businessData.managerUid as string | null) ?? null;
  const legacyAdminUserId = (businessData.adminUserId as string | null) ?? null;

  if (managerUid) {
    const userDoc = await db.collection(COLLECTIONS.users).doc(managerUid).get();
    if (userDoc.exists) {
      const data = userDoc.data()!;
      const membershipDoc = await userDoc.ref
        .collection(COLLECTIONS.memberships)
        .doc(businessId)
        .get();
      const membership = membershipDoc.data() as BusinessMembership | undefined;
      let emailVerified = false;
      try {
        const authUser = await admin.auth().getUser(managerUid);
        emailVerified = authUser.emailVerified;
      } catch {
        emailVerified = false;
      }

      return {
        uid: managerUid,
        name: (data.displayName as string) ?? null,
        email: (data.email as string) ?? null,
        phone: (businessData.managerPhone as string | null) ?? null,
        role: "business_admin",
        accountStatus: (data.status as AccountStatus) ?? "pending",
        invitationStatus:
          (businessData.managerInvitationStatus as ManagerInvitationStatus) ??
          (membership?.status === "active" ? "active" : "invitation_pending"),
        emailVerified,
        mfaEnabled: true,
        lastLoginAt: (data.lastLoginAt as string | null) ?? null,
        incompleteReason: null,
      };
    }
  }

  if (legacyAdminUserId) {
    const legacyDoc = await db
      .collection(COLLECTIONS.adminUsers)
      .doc(legacyAdminUserId)
      .get();
    if (legacyDoc.exists) {
      const legacy = legacyDoc.data()!;
      const email = (legacy.email as string | null) ?? null;
      return {
        uid: null,
        name: (legacy.name as string) ?? null,
        email,
        phone: (legacy.phone as string) ?? null,
        role: "business_admin",
        accountStatus: email ? "pending" : "incomplete",
        invitationStatus: email ? "invitation_pending" : "incomplete",
        emailVerified: false,
        mfaEnabled: true,
        lastLoginAt: null,
        incompleteReason: email
          ? null
          : "Manager email is required to activate dashboard access.",
      };
    }
  }

  return {
    uid: null,
    name: null,
    email: null,
    phone: null,
    role: "business_admin",
    accountStatus: "incomplete",
    invitationStatus: "incomplete",
    emailVerified: false,
    mfaEnabled: true,
    lastLoginAt: null,
    incompleteReason: "No company manager assigned.",
  };
}

export async function provisionCompanyManager(
  businessId: string,
  options: {
    adminName: string;
    adminEmail: string;
    adminPhone?: string | null;
    inviterUid: string;
  }
): Promise<{ uid: string; created: boolean }> {
  const email = normalizeEmail(options.adminEmail);
  const existing = await getUserByEmail(email);

  const result = await createOrLinkUser({
    email,
    displayName: options.adminName.trim(),
    primaryRole: "business_admin",
    createdBy: options.inviterUid,
    businessId,
    membershipRole: "business_admin",
    source: "manual",
  });

  await upsertMembership(result.uid, businessId, {
    role: "business_admin",
    status: "pending",
    joinedAt: nowIso(),
    source: "manual",
    invitedBy: options.inviterUid,
    passengerAccess: false,
    driverAccess: false,
  });

  const loaded = await loadAuthenticatedUser(result.uid);
  if (loaded) await syncCustomClaims(loaded);

  const hasPassword = await userHasPassword(email);
  if (!hasPassword) {
    await sendPasswordSetupLink(email);
  }

  await db.collection(COLLECTIONS.businesses).doc(businessId).set(
    {
      managerUid: result.uid,
      managerEmail: email,
      managerPhone: options.adminPhone?.trim() || null,
      managerInvitationStatus: "invitation_pending" as ManagerInvitationStatus,
      updatedAt: nowIso(),
    },
    { merge: true }
  );

  return result;
}

export async function replaceCompanyManager(
  businessId: string,
  options: {
    adminName: string;
    adminEmail: string;
    adminPhone?: string | null;
    inviterUid: string;
  }
): Promise<{ uid: string }> {
  const businessRef = db.collection(COLLECTIONS.businesses).doc(businessId);
  const businessDoc = await businessRef.get();
  if (!businessDoc.exists) throw new Error("Business not found.");

  const previousUid = businessDoc.data()?.managerUid as string | undefined;
  if (previousUid) {
    const membershipRef = db
      .collection(COLLECTIONS.users)
      .doc(previousUid)
      .collection(COLLECTIONS.memberships)
      .doc(businessId);
    const membershipDoc = await membershipRef.get();
    if (membershipDoc.exists) {
      const data = membershipDoc.data() as Omit<BusinessMembership, "businessId">;
      await upsertMembership(previousUid, businessId, {
        ...data,
        status: "revoked",
        role: "business_viewer",
        passengerAccess: false,
        driverAccess: false,
      });
    }
  }

  const { uid } = await provisionCompanyManager(businessId, options);
  await businessRef.set(
    {
      managerInvitationStatus: "invitation_pending",
      updatedAt: nowIso(),
    },
    { merge: true }
  );

  await db.collection("audit_logs").add({
    action: "replace_company_manager",
    businessId,
    performedBy: options.inviterUid,
    at: nowIso(),
    targetUid: uid,
  });

  return { uid };
}

export async function migrateLegacyManagerEmail(
  businessId: string,
  adminEmail: string,
  inviterUid: string
): Promise<{ uid: string }> {
  const businessDoc = await db.collection(COLLECTIONS.businesses).doc(businessId).get();
  if (!businessDoc.exists) throw new Error("Business not found.");
  const data = businessDoc.data()!;
  const legacyId = data.adminUserId as string | undefined;
  if (!legacyId) throw new Error("No legacy manager to migrate.");

  const legacyDoc = await db.collection(COLLECTIONS.adminUsers).doc(legacyId).get();
  if (!legacyDoc.exists) throw new Error("Legacy manager not found.");
  const legacy = legacyDoc.data()!;

  const { uid } = await provisionCompanyManager(businessId, {
    adminName: (legacy.name as string) ?? "Manager",
    adminEmail,
    adminPhone: (legacy.phone as string) ?? null,
    inviterUid,
  });

  await db.collection(COLLECTIONS.adminUsers).doc(legacyId).set(
    {
      status: "migrated",
      migratedToUid: uid,
      updatedAt: nowIso(),
    },
    { merge: true }
  );

  return { uid };
}

export async function countIncompleteLegacyManagers(): Promise<number> {
  const snap = await db.collection(COLLECTIONS.businesses).get();
  let count = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.managerUid) continue;
    const legacyId = data.adminUserId as string | undefined;
    if (!legacyId) {
      count += 1;
      continue;
    }
    const legacyDoc = await db.collection(COLLECTIONS.adminUsers).doc(legacyId).get();
    if (!legacyDoc.exists || !(legacyDoc.data()?.email as string | undefined)?.trim()) {
      count += 1;
    }
  }
  return count;
}
