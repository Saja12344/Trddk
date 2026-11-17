import type { AccountStatus, BusinessMembership, ManagerInvitationStatus } from "@tardadi/shared";
import { COLLECTIONS } from "@tardadi/shared";
import { admin, db } from "../firebase";
import { syncCustomClaims, loadAuthenticatedUser } from "../auth/firebaseAuth";
import {
  createOrLinkUser,
  normalizeEmail,
  sendPasswordSetupLink,
  upsertMembership,
} from "./users";

function nowIso(): string {
  return new Date().toISOString();
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

  const savedEmail =
    optionalString(businessData.managerEmail) ||
    optionalString(businessData.adminEmail);
  const savedName =
    optionalString(businessData.managerName) ||
    optionalString(businessData.adminName);
  const savedPhone =
    optionalString(businessData.managerPhone) ||
    optionalString(businessData.adminPhone);

  return {
    uid: null,
    name: savedName,
    email: savedEmail,
    phone: savedPhone,
    role: "business_admin",
    accountStatus: savedEmail ? "pending" : "incomplete",
    invitationStatus: savedEmail ? "invitation_pending" : "incomplete",
    emailVerified: false,
    mfaEnabled: true,
    lastLoginAt: null,
    incompleteReason: savedEmail
      ? null
      : "أضف بريد المدير ثم أرسل الدعوة مرة واحدة.",
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
    status: "active",
    joinedAt: nowIso(),
    source: "manual",
    invitedBy: options.inviterUid,
    passengerAccess: false,
    driverAccess: false,
  });

  const loaded = await loadAuthenticatedUser(result.uid);
  if (loaded) await syncCustomClaims(loaded);

  await db.collection(COLLECTIONS.businesses).doc(businessId).set(
    {
      managerUid: result.uid,
      managerName: options.adminName.trim(),
      managerEmail: email,
      adminEmail: email,
      adminName: options.adminName.trim(),
      managerPhone: options.adminPhone?.trim() || null,
      managerInvitationStatus: "invitation_pending" as ManagerInvitationStatus,
      status: "active",
      updatedAt: nowIso(),
    },
    { merge: true }
  );

  return result;
}

export const MANAGER_INVITE_COOLDOWN_MS = 60_000;

export async function sendCompanyManagerInvite(
  businessId: string,
  email: string
): Promise<{ sent: true; retryAfterSec: number }> {
  const normalized = normalizeEmail(email);
  const ref = db.collection(COLLECTIONS.businesses).doc(businessId);
  const doc = await ref.get();
  if (!doc.exists) {
    throw new Error("لم نجد هذه الشركة.");
  }

  const lastSentAt = doc.data()?.managerInviteSentAt as string | undefined;
  if (lastSentAt) {
    const elapsed = Date.now() - Date.parse(lastSentAt);
    if (Number.isFinite(elapsed) && elapsed < MANAGER_INVITE_COOLDOWN_MS) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((MANAGER_INVITE_COOLDOWN_MS - elapsed) / 1000)
      );
      const error = new Error(
        `انتظر ${retryAfterSec} ثانية قبل إعادة إرسال الدعوة.`
      ) as Error & { status: number };
      error.status = 429;
      throw error;
    }
  }

  await sendPasswordSetupLink(normalized);
  await ref.set(
    {
      managerInviteSentAt: nowIso(),
      managerInvitationStatus: "invitation_pending" as ManagerInvitationStatus,
      status: "active",
      adminEmail: normalized,
      managerEmail: normalized,
      updatedAt: nowIso(),
    },
    { merge: true }
  );

  return { sent: true, retryAfterSec: MANAGER_INVITE_COOLDOWN_MS / 1000 };
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
