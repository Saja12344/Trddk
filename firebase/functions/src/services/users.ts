import type {
  AccountStatus,
  BulkImportPreview,
  BulkImportPreviewRow,
  BulkImportResult,
  BulkImportRow,
  BusinessMembership,
  InviteUserRequest,
  MembershipRole,
  PrimaryRole,
  TrddkUser,
} from "@tardadi/shared";
import { COLLECTIONS, isAdminPanelRole, phoneCandidates, requireSaudiMobile } from "@tardadi/shared";
import { admin, db } from "../firebase";
import { syncCustomClaims, loadAuthenticatedUser } from "../auth/firebaseAuth";
import { saveDriverAssignment } from "./driverAssignment";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function getUserByEmail(email: string): Promise<TrddkUser | null> {
  const normalized = normalizeEmail(email);
  const snap = await db
    .collection(COLLECTIONS.users)
    .where("email", "==", normalized)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data();
  return {
    uid: doc.id,
    email: (data.email as string) ?? "",
    phone: (data.phone as string | null) ?? null,
    displayName: data.displayName as string,
    primaryRole: data.primaryRole as PrimaryRole,
    status: data.status as AccountStatus,
    createdAt: data.createdAt as string | undefined,
    createdBy: (data.createdBy as string | null) ?? null,
    lastLoginAt: (data.lastLoginAt as string | null) ?? null,
    legacyAdminUserId: (data.legacyAdminUserId as string | null) ?? null,
  };
}

export async function createFirebaseAuthUser(
  email: string,
  displayName: string
): Promise<string> {
  const normalized = normalizeEmail(email);
  try {
    const existing = await admin.auth().getUserByEmail(normalized);
    return existing.uid;
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/user-not-found") throw err;
  }

  const record = await admin.auth().createUser({
    email: normalized,
    displayName,
    emailVerified: false,
    disabled: false,
  });
  return record.uid;
}

function mapUserDoc(
  uid: string,
  data: FirebaseFirestore.DocumentData
): TrddkUser {
  return {
    uid,
    email: (data.email as string) ?? "",
    phone: (data.phone as string | null) ?? null,
    displayName: data.displayName as string,
    primaryRole: data.primaryRole as PrimaryRole,
    status: data.status as AccountStatus,
    createdAt: data.createdAt as string | undefined,
    createdBy: (data.createdBy as string | null) ?? null,
    lastLoginAt: (data.lastLoginAt as string | null) ?? null,
    legacyAdminUserId: (data.legacyAdminUserId as string | null) ?? null,
  };
}

export async function findFirestoreUsersByPhone(phone: string): Promise<TrddkUser[]> {
  const candidates = phoneCandidates(phone).slice(0, 10);
  if (candidates.length === 0) return [];
  const snap = await db
    .collection(COLLECTIONS.users)
    .where("phone", "in", candidates)
    .limit(10)
    .get();
  return snap.docs.map((doc) => mapUserDoc(doc.id, doc.data()));
}

export async function assertPhoneAvailableInBusiness(
  phone: string,
  businessId: string,
  exceptUid?: string
): Promise<void> {
  const normalized = requireSaudiMobile(phone);
  const uids = new Set<string>(
    (await findFirestoreUsersByPhone(normalized)).map((user) => user.uid)
  );
  try {
    const authUser = await admin.auth().getUserByPhoneNumber(normalized);
    uids.add(authUser.uid);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/user-not-found") throw err;
  }

  for (const uid of uids) {
    if (uid === exceptUid) continue;
    const membership = await db
      .collection(COLLECTIONS.users)
      .doc(uid)
      .collection(COLLECTIONS.memberships)
      .doc(businessId)
      .get();
    if (membership.exists && membership.data()?.status !== "revoked") {
      throw new Error("رقم الجوال مسجل مسبقاً في هذه الشركة.");
    }
  }
}

export async function storeBeneficiaryPhone(
  uid: string,
  phone: string,
  businessId: string
): Promise<string> {
  const normalized = requireSaudiMobile(phone);
  await assertPhoneAvailableInBusiness(normalized, businessId, uid);
  try {
    const authUser = await admin.auth().getUser(uid);
    if (authUser.phoneNumber !== normalized) {
      await admin.auth().updateUser(uid, { phoneNumber: normalized });
    }
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "auth/user-not-found") {
      throw new Error("المستخدم غير موجود.");
    }
    if (code === "auth/phone-number-already-exists") {
      throw new Error("رقم الجوال مرتبط بحساب آخر.");
    }
    throw err;
  }

  const now = nowIso();
  await db.collection(COLLECTIONS.users).doc(uid).set(
    { phone: normalized, updatedAt: now },
    { merge: true }
  );
  await db
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(COLLECTIONS.memberships)
    .doc(businessId)
    .set({ phone: normalized }, { merge: true });
  return normalized;
}

async function findBeneficiaryUser(
  phone: string,
  email: string
): Promise<TrddkUser | null> {
  const byPhone = await findFirestoreUsersByPhone(phone);
  if (byPhone[0]) return byPhone[0];
  try {
    const authUser = await admin.auth().getUserByPhoneNumber(phone);
    const doc = await db.collection(COLLECTIONS.users).doc(authUser.uid).get();
    if (doc.exists) return mapUserDoc(doc.id, doc.data()!);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/user-not-found") throw err;
  }
  if (email) return getUserByEmail(email);
  return null;
}

async function resolveUidForPhone(
  phone: string,
  email: string,
  displayName: string
): Promise<string> {
  try {
    const byPhone = await admin.auth().getUserByPhoneNumber(phone);
    const updates: admin.auth.UpdateRequest = {};
    if (displayName && !byPhone.displayName) updates.displayName = displayName;
    if (email && !byPhone.email) {
      updates.email = email;
      updates.emailVerified = false;
    }
    if (Object.keys(updates).length > 0) {
      await admin.auth().updateUser(byPhone.uid, updates);
    }
    return byPhone.uid;
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/user-not-found") throw err;
  }

  if (email) {
    try {
      const byEmail = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(byEmail.uid, {
        phoneNumber: phone,
        displayName: byEmail.displayName || displayName,
      });
      return byEmail.uid;
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code !== "auth/user-not-found") throw err;
    }
  }

  const created = await admin.auth().createUser({
    phoneNumber: phone,
    displayName,
    disabled: false,
    ...(email ? { email, emailVerified: false } : {}),
  });
  return created.uid;
}

const TRDDK_WEB_API_KEY = "AIzaSyDF72v_3g4nkc7YUIIRkLLmlzPsDBYBHbI";

export async function sendPasswordSetupLink(
  email: string
): Promise<void> {
  const normalized = normalizeEmail(email);

  const apiKey =
    process.env.IDENTITY_TOOLKIT_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
    TRDDK_WEB_API_KEY;

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email: normalized,
        continueUrl: "https://www.tardadi.com/reset-password",
      }),
    }
  );

  if (res.ok) {
    return;
  }

  const text = await res.text();
  throw new Error(
    `تعذّر إرسال رابط كلمة المرور: ${text.slice(0, 160)}`
  );
}

export interface CreateUserOptions {
  email?: string;
  phone?: string | null;
  displayName: string;
  primaryRole: PrimaryRole;
  createdBy: string;
  businessId?: string | null;
  membershipRole?: MembershipRole | null;
  employeeNumber?: string | null;
  department?: string | null;
  driverId?: string | null;
  source?: BusinessMembership["source"];
  legacyAdminUserId?: string | null;
  passengerAccess?: boolean;
  driverAccess?: boolean;
}

export async function createOrLinkUser(
  options: CreateUserOptions
): Promise<{ uid: string; created: boolean }> {
  const email = options.email?.trim() ? normalizeEmail(options.email) : "";
  const phone = options.phone?.trim() ? requireSaudiMobile(options.phone) : "";
  if (!email && !phone) {
    throw new Error("رقم الجوال أو البريد الإلكتروني مطلوب.");
  }
  if (email && !EMAIL_RE.test(email)) {
    throw new Error("البريد الإلكتروني غير صالح.");
  }
  if (phone && options.businessId) {
    await assertPhoneAvailableInBusiness(phone, options.businessId);
  }

  const uid = phone
    ? await resolveUidForPhone(phone, email, options.displayName)
    : await createFirebaseAuthUser(email, options.displayName);
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const existing = await userRef.get();
  const created = !existing.exists;
  const existingData = existing.exists ? existing.data()! : null;
  const existingPrimaryRole = existingData?.primaryRole as PrimaryRole | undefined;
  const preserveIdentity =
    !created &&
    existingPrimaryRole !== undefined &&
    (isAdminPanelRole(existingPrimaryRole) || existingPrimaryRole === "driver");

  const userPayload: Record<string, unknown> = {
    displayName: existingData?.displayName || options.displayName,
    updatedAt: nowIso(),
    legacyAdminUserId: options.legacyAdminUserId ?? null,
  };
  if (email) userPayload.email = email;
  if (phone) userPayload.phone = phone;

  if (created) {
    userPayload.primaryRole = options.primaryRole;
    userPayload.status = "pending" as AccountStatus;
    userPayload.createdAt = nowIso();
    userPayload.createdBy = options.createdBy;
    userPayload.hasPassword = false;
  } else if (!preserveIdentity) {
    userPayload.primaryRole = options.primaryRole;
  }

  await userRef.set(userPayload, { merge: true });

  if (options.businessId && options.membershipRole) {
    const isPanelRole =
      options.membershipRole === "business_admin" ||
      options.membershipRole === "business_viewer";
    const membershipRef = userRef
      .collection(COLLECTIONS.memberships)
      .doc(options.businessId);
    const existingMembership = await membershipRef.get();
    const existingMembershipData = existingMembership.data();
    const existingMembershipRole = existingMembershipData?.role as
      | MembershipRole
      | undefined;
    const preserveMembershipRole =
      existingMembership.exists &&
      existingMembershipRole !== undefined &&
      (existingMembershipRole === "business_admin" ||
        existingMembershipRole === "business_viewer");
    const inviteAsActivePanel = isPanelRole;
    const passengerAccess =
      options.passengerAccess !== undefined
        ? options.passengerAccess
        : !isPanelRole;
    const driverAccess =
      options.driverAccess !== undefined
        ? options.driverAccess
        : options.membershipRole === "driver";

    await upsertMembership(uid, options.businessId, {
      role: preserveMembershipRole
        ? existingMembershipRole!
        : options.membershipRole,
      status:
        existingMembershipData?.status === "active" || inviteAsActivePanel
          ? "active"
          : ((existingMembershipData?.status as AccountStatus | undefined) ??
            "pending"),
      joinedAt: (existingMembershipData?.joinedAt as string | undefined) ?? nowIso(),
      source: options.source ?? "invite",
      invitedBy: options.createdBy,
      employeeNumber: options.employeeNumber ?? null,
      department: options.department ?? null,
      driverId: options.driverId ?? null,
      ...(phone ? { phone } : {}),
      passengerAccess,
      driverAccess,
    });
  }

  const loaded = await loadAuthenticatedUser(uid);
  if (loaded) {
    await syncCustomClaims(loaded);
  }

  return { uid, created };
}

function withoutUndefinedFields(
  membership: Omit<BusinessMembership, "businessId">
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...membership };
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  }
  return payload;
}

export async function upsertMembership(
  uid: string,
  businessId: string,
  membership: Omit<BusinessMembership, "businessId">
): Promise<void> {
  const ref = db
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(COLLECTIONS.memberships)
    .doc(businessId);

  const payload = withoutUndefinedFields(membership);
  const existing = await ref.get();
  if (existing.exists) {
    const existingBusinessId = existing.id;
    const existingData = existing.data()!;
    if (existingData.status === "revoked") {
      await ref.set(
        {
          ...payload,
          joinedAt: membership.joinedAt ?? nowIso(),
        },
        { merge: true }
      );
      return;
    }
    if (existingBusinessId !== businessId) {
      throw new Error("العضوية موجودة مسبقاً.");
    }
    await ref.set(payload, { merge: true });
    return;
  }

  await ref.set({
    ...payload,
    joinedAt: membership.joinedAt ?? nowIso(),
  });
}

export async function userHasPassword(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  try {
    const authUser = await admin.auth().getUserByEmail(normalized);
    const userDoc = await db.collection(COLLECTIONS.users).doc(authUser.uid).get();
    if (userDoc.data()?.hasPassword === true) {
      return true;
    }
    if (authUser.providerData.some((p) => p.providerId === "password")) {
      return true;
    }
    return Boolean(authUser.metadata.lastSignInTime);
  } catch {
    return false;
  }
}

/** Create/link Firebase user; send setup email only when no password exists yet. */
export async function provisionDriverEmailAccount(
  options: CreateUserOptions
): Promise<{ setupEmailSent: boolean }> {
  await createOrLinkUser(options);
  const email = options.email?.trim();
  if (!email) return { setupEmailSent: false };
  const hasPassword = await userHasPassword(email);
  if (hasPassword) {
    return { setupEmailSent: false };
  }
  await sendPasswordSetupLink(normalizeEmail(email));
  return { setupEmailSent: true };
}

export async function resolveAppLoginHint(
  email: string,
  app: "driver" | "passenger" | "admin"
): Promise<{ requiresPassword: boolean }> {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error("لا يوجد حساب بهذا البريد.");
  }

  if (app === "driver") {
    const { userMayUseDriverApp } = await import("./firebaseAppSession");
    const loaded = await loadAuthenticatedUser(user.uid);
    if (!loaded || !userMayUseDriverApp(loaded)) {
      throw new Error("This account is not authorized for the driver app.");
    }
  }

  if (app === "passenger") {
    const { listPassengerMemberships } = await import("./passengerSession");
    const memberships = await listPassengerMemberships(email);
    if (memberships.length === 0) {
      throw new Error("هذا الحساب غير مخول لتطبيق الموظفين.");
    }
  }

  if (app === "admin" && !isAdminPanelRole(user.primaryRole)) {
    throw new Error("هذا الحساب غير مخول للوحة الإدارة.");
  }

  const requiresPassword = await userHasPassword(email);
  return { requiresPassword };
}

export async function inviteUser(
  inviterUid: string,
  request: InviteUserRequest
): Promise<{ uid: string; created: boolean }> {
  const email = request.email?.trim() ? normalizeEmail(request.email) : "";
  const phone = request.phone?.trim() ? requireSaudiMobile(request.phone) : "";
  const phoneAccount =
    request.primaryRole === "employee" ||
    request.primaryRole === "driver" ||
    request.membershipRole === "employee" ||
    request.membershipRole === "driver";
  if (phoneAccount && !phone) {
    throw new Error("رقم الجوال مطلوب.");
  }
  if (!phoneAccount && !email) {
    throw new Error("البريد الإلكتروني مطلوب.");
  }

  const result = await createOrLinkUser({
    email,
    phone,
    displayName: request.displayName,
    primaryRole: request.primaryRole,
    createdBy: inviterUid,
    businessId: request.businessId ?? null,
    membershipRole: request.membershipRole ?? null,
    employeeNumber: request.employeeNumber ?? null,
    department: request.department ?? null,
    source: "invite",
    passengerAccess: request.membershipRole === "driver" ? false : undefined,
    driverAccess: request.membershipRole === "driver" ? true : undefined,
  });

  if (
    request.businessId &&
    email &&
    (request.primaryRole === "business_admin" ||
      request.membershipRole === "business_admin")
  ) {
    await db.collection(COLLECTIONS.businesses).doc(request.businessId).set(
      {
        adminEmail: email,
        adminUserId: result.uid,
        status: "active",
        updatedAt: nowIso(),
      },
      { merge: true }
    );
  }

  if (!email) {
    return result;
  }

  try {
    const hasPassword = await userHasPassword(email);
    if (!hasPassword) {
      await sendPasswordSetupLink(email);
    }
  } catch (error) {
    console.error("invite password setup email failed", error);
  }
  return result;
}

export async function recordLogin(uid: string): Promise<void> {
  await db.collection(COLLECTIONS.users).doc(uid).set(
    { lastLoginAt: nowIso(), status: "active", hasPassword: true },
    { merge: true }
  );
}

const PHONE_HEADERS = [
  "phone",
  "mobile",
  "mobile number",
  "الجوال",
  "رقم الجوال",
  "رقم الجوال *",
];
const NAME_HEADERS = ["الاسم", "اسم الموظف", "name", "employee name", "display name"];
const EMAIL_HEADERS = [
  "الإيميل",
  "البريد الإلكتروني",
  "email",
  "email address",
  "work email",
];
const EMP_ID_HEADERS = ["الرقم الوظيفي", "employee id", "staff number", "employee number"];
const ROLE_HEADERS = ["الدور", "role", "membership role"];

const PASSENGER_ROLE_VALUES = new Set([
  "passenger",
  "employee",
  "راكب",
]);
const DRIVER_ROLE_VALUES = new Set(["driver", "سائق"]);
const BOTH_ROLE_VALUES = new Set(["both", "كلاهما", "passenger and driver"]);

export function parseImportRole(raw: string): {
  importRole: "passenger" | "driver" | "both";
  membershipRole: MembershipRole;
  passengerAccess: boolean;
  driverAccess: boolean;
} | null {
  const v = raw.trim().toLowerCase();
  if (!v) {
    return {
      importRole: "passenger",
      membershipRole: "employee",
      passengerAccess: true,
      driverAccess: false,
    };
  }
  if (BOTH_ROLE_VALUES.has(v)) {
    return {
      importRole: "both",
      membershipRole: "employee",
      passengerAccess: true,
      driverAccess: true,
    };
  }
  if (DRIVER_ROLE_VALUES.has(v)) {
    return {
      importRole: "driver",
      membershipRole: "driver",
      passengerAccess: false,
      driverAccess: true,
    };
  }
  if (PASSENGER_ROLE_VALUES.has(v)) {
    return {
      importRole: "passenger",
      membershipRole: "employee",
      passengerAccess: true,
      driverAccess: false,
    };
  }
  const allowedAdmin: MembershipRole[] = [
    "employee",
    "business_viewer",
    "driver",
    "business_admin",
  ];
  if (allowedAdmin.includes(v as MembershipRole)) {
    const membershipRole = v as MembershipRole;
    return {
      importRole: membershipRole === "driver" ? "driver" : "passenger",
      membershipRole,
      passengerAccess: membershipRole !== "driver",
      driverAccess: membershipRole === "driver",
    };
  }
  return null;
}
const DEPT_HEADERS = ["القسم", "department", "dept"];

function headerKey(raw: string): string {
  return raw.trim().toLowerCase();
}

function detectColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map(headerKey);
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

export function parseBulkImportRows(
  headers: string[],
  rows: string[][],
  defaultRole: MembershipRole = "employee"
): { rows: BulkImportRow[]; preview: BulkImportPreview } {
  const nameIdx = detectColumn(headers, NAME_HEADERS);
  const phoneIdx = detectColumn(headers, PHONE_HEADERS);
  const emailIdx = detectColumn(headers, EMAIL_HEADERS);
  const empIdx = detectColumn(headers, EMP_ID_HEADERS);
  const roleIdx = detectColumn(headers, ROLE_HEADERS);
  const deptIdx = detectColumn(headers, DEPT_HEADERS);

  const errors: BulkImportPreview["errors"] = [];
  const parsed: BulkImportRow[] = [];
  const seenPhones = new Set<string>();
  let invalidEmails = 0;
  let invalidPhones = 0;
  let duplicatesInFile = 0;
  let missingRequired = 0;
  let invalidRoles = 0;

  rows.forEach((cells, index) => {
    const rowNumber = index + 2;
    const displayName = nameIdx >= 0 ? (cells[nameIdx] ?? "").trim() : "";
    const phoneRaw = phoneIdx >= 0 ? (cells[phoneIdx] ?? "").trim() : "";
    const emailRaw = emailIdx >= 0 ? (cells[emailIdx] ?? "").trim() : "";
    const email = emailRaw ? normalizeEmail(emailRaw) : "";

    if (!displayName || !phoneRaw) {
      missingRequired += 1;
      errors.push({ rowNumber, message: "الاسم ورقم الجوال مطلوبان." });
      return;
    }
    let phone = "";
    try {
      phone = requireSaudiMobile(phoneRaw);
    } catch {
      invalidPhones += 1;
      errors.push({ rowNumber, message: "رقم جوال غير صالح." });
      return;
    }
    if (email && !EMAIL_RE.test(email)) {
      invalidEmails += 1;
      errors.push({ rowNumber, message: "إيميل غير صالح." });
      return;
    }
    if (seenPhones.has(phone)) {
      duplicatesInFile += 1;
      errors.push({ rowNumber, message: "رقم الجوال مكرر في الملف." });
      return;
    }
    seenPhones.add(phone);

    const roleRaw = roleIdx >= 0 ? (cells[roleIdx] ?? "").trim() : "";
    const parsedRole = parseImportRole(roleRaw);
    if (roleRaw && !parsedRole) {
      invalidRoles += 1;
      errors.push({ rowNumber, message: "قيمة دور غير مدعومة." });
      return;
    }

    const role = parsedRole?.membershipRole ?? defaultRole;
    parsed.push({
      rowNumber,
      displayName,
      email,
      phone,
      employeeNumber: empIdx >= 0 ? cells[empIdx]?.trim() || null : null,
      role,
      department: deptIdx >= 0 ? cells[deptIdx]?.trim() || null : null,
      importRole: parsedRole?.importRole ?? "passenger",
      passengerAccess: parsedRole?.passengerAccess ?? true,
      driverAccess: parsedRole?.driverAccess ?? false,
    });
  });

  const previewRows: BulkImportPreviewRow[] = parsed.map((row) => ({
    ...row,
    validationStatus: "valid",
    action: "import",
  }));

  return {
    rows: parsed,
    preview: {
      totalRows: rows.length,
      validRows: parsed.length,
      invalidEmails,
      duplicatesInFile,
      existingUsers: 0,
      missingRequired,
      invalidPhones,
      invalidRoles,
      preview: previewRows,
      errors,
    },
  };
}

export async function enrichBulkImportPreview(
  businessId: string,
  parsed: BulkImportRow[]
): Promise<BulkImportPreview> {
  let existingUsers = 0;
  const previewRows: BulkImportPreviewRow[] = [];

  for (const row of parsed) {
    const existing = await findBeneficiaryUser(row.phone, row.email);
    let existingInCompany = false;
    let action: BulkImportPreviewRow["action"] = "import";
    let message: string | undefined;

    if (existing) {
      existingUsers += 1;
      const membershipRef = db
        .collection(COLLECTIONS.users)
        .doc(existing.uid)
        .collection(COLLECTIONS.memberships)
        .doc(businessId);
      const membershipDoc = await membershipRef.get();
      if (membershipDoc.exists && membershipDoc.data()?.status !== "revoked") {
        existingInCompany = true;
        const current = membershipDoc.data() as BusinessMembership;
        const roleChanged =
          (row.driverAccess && !current.driverAccess && current.role !== "driver") ||
          (row.passengerAccess !== false && current.passengerAccess === false);
        if (roleChanged) {
          action = "update";
          message = "سيتم تحديث الأدوار.";
        } else {
          action = "skip";
          message = "موظف موجود مسبقاً في الشركة.";
        }
      } else if (existing) {
        action = "import";
        message = "سيتم ربط حساب موجود بالشركة.";
      }
    }

    previewRows.push({
      ...row,
      validationStatus: "valid",
      action,
      message,
      existingInCompany,
      existingGlobally: Boolean(existing),
    });
  }

  const invalidRoles = 0;
  return {
    totalRows: parsed.length,
    validRows: parsed.length,
    invalidEmails: 0,
    duplicatesInFile: 0,
    existingUsers,
    missingRequired: 0,
    invalidPhones: 0,
    invalidRoles,
    preview: previewRows,
    errors: [],
  };
}

export async function executeBulkImport(
  inviterUid: string,
  businessId: string,
  rows: BulkImportRow[]
): Promise<BulkImportResult> {
  const result: BulkImportResult = {
    created: 0,
    linked: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  for (const row of rows) {
    try {
      const existing = await findBeneficiaryUser(row.phone, row.email);
      const membershipRole = row.role ?? "employee";
      const passengerAccess = row.passengerAccess ?? true;
      const driverAccess = row.driverAccess ?? membershipRole === "driver";
      let accountUid: string | null = existing?.uid ?? null;

      const attachDriver = async () => {
        if (!driverAccess || !row.phone?.trim() || !accountUid) return;
        const saved = await saveDriverAssignment(db, {
          businessId,
          name: row.displayName || row.phone,
          phone: row.phone,
          allowUnassigned: true,
        });
        await db
          .collection(COLLECTIONS.users)
          .doc(accountUid)
          .collection(COLLECTIONS.memberships)
          .doc(businessId)
          .set({ driverId: saved.driverId, driverAccess: true }, { merge: true });
      };

      if (existing) {
        const membershipRef = db
          .collection(COLLECTIONS.users)
          .doc(existing.uid)
          .collection(COLLECTIONS.memberships)
          .doc(businessId);
        const membershipDoc = await membershipRef.get();

        if (membershipDoc.exists && membershipDoc.data()?.status !== "revoked") {
          const current = membershipDoc.data() as BusinessMembership;
          const roleChanged =
            driverAccess !== (current.driverAccess ?? current.role === "driver") ||
            passengerAccess !== (current.passengerAccess ?? current.role !== "driver");
          if (!roleChanged) {
            await attachDriver();
            result.skipped += 1;
            result.details.push({
              email: row.email,
              phone: row.phone,
              status: "skipped",
              message: "عضوية موجودة مسبقاً.",
            });
            continue;
          }

          await upsertMembership(existing.uid, businessId, {
            ...current,
            role: driverAccess && !passengerAccess ? "driver" : membershipRole,
            passengerAccess,
            driverAccess,
            phone: row.phone,
            status: current.status,
            source: current.source ?? "bulk_import",
          });
          await storeBeneficiaryPhone(existing.uid, row.phone, businessId);
          await attachDriver();
          result.updated += 1;
          result.details.push({ email: row.email, phone: row.phone, status: "updated" });
          continue;
        }

        await upsertMembership(existing.uid, businessId, {
          role: membershipRole,
          status: "pending",
          joinedAt: nowIso(),
          source: "bulk_import",
          invitedBy: inviterUid,
          employeeNumber: row.employeeNumber ?? null,
          department: row.department ?? null,
          phone: row.phone,
          passengerAccess,
          driverAccess,
        });
        await storeBeneficiaryPhone(existing.uid, row.phone, businessId);
        await attachDriver();
        if (row.email) {
          const hasPassword = await userHasPassword(row.email);
          if (!hasPassword) await sendPasswordSetupLink(row.email);
        }
        result.linked += 1;
        result.details.push({ email: row.email, phone: row.phone, status: "linked" });
        continue;
      }

      const primaryRole =
        driverAccess && !passengerAccess ? "driver" : "employee";
      const { created, uid } = await createOrLinkUser({
        email: row.email,
        phone: row.phone,
        displayName: row.displayName,
        primaryRole,
        createdBy: inviterUid,
        businessId,
        membershipRole,
        employeeNumber: row.employeeNumber ?? null,
        department: row.department ?? null,
        source: "bulk_import",
        passengerAccess,
        driverAccess,
      });
      accountUid = uid;
      await attachDriver();

      if (row.email) {
        const hasPassword = await userHasPassword(row.email);
        if (!hasPassword) await sendPasswordSetupLink(row.email);
      }
      if (created) {
        result.created += 1;
        result.details.push({ email: row.email, phone: row.phone, status: "created" });
      } else {
        result.linked += 1;
        result.details.push({ email: row.email, phone: row.phone, status: "linked" });
      }
    } catch (err) {
      result.failed += 1;
      result.details.push({
        email: row.email,
        phone: row.phone,
        status: "failed",
        message: (err as Error).message,
      });
    }
  }

  await db.collection("audit_logs").add({
    action: "bulk_import",
    businessId,
    performedBy: inviterUid,
    at: nowIso(),
    summary: {
      created: result.created,
      linked: result.linked,
      skipped: result.skipped,
      failed: result.failed,
    },
  });

  return result;
}

export function assertCanInviteRole(
  inviterRole: PrimaryRole,
  targetRole: PrimaryRole
): void {
  if (targetRole === "super_admin") {
    throw new Error("لا يمكن دعوة super_admin من الواجهة.");
  }
  if (targetRole === "platform_admin" && inviterRole !== "super_admin") {
    throw new Error("فقط super_admin يمكنه دعوة platform_admin.");
  }
  if (isAdminPanelRole(targetRole) && inviterRole === "business_admin") {
    throw new Error("مسؤول الشركة لا يمكنه منح صلاحيات إدارية عامة.");
  }
}
