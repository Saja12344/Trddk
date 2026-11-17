import { createHash, randomInt } from "crypto";
import type { AdminPanelRole, AuthenticatedUser } from "@tardadi/shared";
import { COLLECTIONS, isAdminPanelRole } from "@tardadi/shared";
import { db } from "../firebase";
import { getJwtSecret, signJwt, verifyJwt } from "../auth/crypto";
import { sendSupportMail } from "../auth/mail";
import { consumeRateLimit } from "../auth/rateLimit";
import {
  loadAuthenticatedUser,
  primaryBusinessId,
  resolveUserFromIdToken,
} from "../auth/firebaseAuth";
import {
  createOrLinkUser,
  getUserByEmail,
  normalizeEmail,
  recordLogin,
} from "./users";

const OTP_TTL_MS = 8 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const CHALLENGE_TTL_SEC = 10 * 60;
const SESSION_TTL_SEC = 8 * 60 * 60;

function hashOtp(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function otpDocId(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export function signAdminMfaChallengeToken(
  uid: string,
  email: string,
  role: AdminPanelRole,
  businessId: string | null
): string {
  return signJwt(
    {
      sub: uid,
      role: "admin_mfa_challenge",
      businessId,
      name: role,
      phone: normalizeEmail(email),
    },
    getJwtSecret(),
    CHALLENGE_TTL_SEC
  );
}

export function parseAdminMfaChallengeToken(
  token: string
): { uid: string; email: string; role: AdminPanelRole; businessId: string | null } | null {
  const payload = verifyJwt(token, getJwtSecret());
  if (!payload || payload.role !== "admin_mfa_challenge") return null;
  const role = payload.name as AdminPanelRole;
  if (!isAdminPanelRole(role)) return null;
  return {
    uid: payload.sub,
    email: payload.phone,
    role,
    businessId: payload.businessId,
  };
}

export function signAdminSessionToken(
  uid: string,
  email: string,
  role: AdminPanelRole,
  businessId: string | null,
  displayName: string
): string {
  return signJwt(
    {
      sub: uid,
      role,
      businessId,
      name: displayName,
      phone: normalizeEmail(email),
      mfa: "1",
    },
    getJwtSecret(),
    SESSION_TTL_SEC
  );
}

export function parseAdminSessionToken(token: string): {
  uid: string;
  email: string;
  role: AdminPanelRole;
  businessId: string | null;
  displayName: string;
} | null {
  const payload = verifyJwt(token, getJwtSecret());
  if (!payload || payload.mfa !== "1" || !isAdminPanelRole(payload.role as AdminPanelRole)) {
    return null;
  }
  return {
    uid: payload.sub,
    email: payload.phone,
    role: payload.role as AdminPanelRole,
    businessId: payload.businessId,
    displayName: payload.name,
  };
}

async function findBusinessIdForManagerEmail(email: string): Promise<string | null> {
  const businesses = await db.collection(COLLECTIONS.businesses).get();
  for (const doc of businesses.docs) {
    const data = doc.data();
    const candidates = [data.adminEmail, data.managerEmail, data.email];
    if (
      candidates.some(
        (value) => typeof value === "string" && normalizeEmail(value) === email
      )
    ) {
      return doc.id;
    }
  }

  const userSnap = await db
    .collection(COLLECTIONS.users)
    .where("email", "==", email)
    .limit(1)
    .get();
  if (!userSnap.empty) {
    const memberships = await userSnap.docs[0].ref
      .collection(COLLECTIONS.memberships)
      .get();
    const adminMembership = memberships.docs.find((doc) => {
      const role = doc.data().role as string | undefined;
      const status = doc.data().status as string | undefined;
      return (
        (role === "business_admin" || role === "business_viewer") &&
        status !== "revoked" &&
        status !== "suspended"
      );
    });
    if (adminMembership) return adminMembership.id;
  }

  const admins = await db.collection(COLLECTIONS.adminUsers).get();
  for (const doc of admins.docs) {
    const data = doc.data();
    const adminEmail =
      typeof data.email === "string" ? normalizeEmail(data.email) : "";
    if (adminEmail === email && typeof data.businessId === "string") {
      return data.businessId;
    }
  }
  return null;
}

export async function autoProvisionCompanyManager(
  idToken: string
): Promise<AuthenticatedUser | null> {
  const { verifyFirebaseIdToken, loadAuthenticatedUser } = await import(
    "../auth/firebaseAuth"
  );
  const decoded = await verifyFirebaseIdToken(idToken);
  const email = decoded?.email ? normalizeEmail(decoded.email) : "";
  if (!decoded?.uid || !email) return null;

  const existing = await getUserByEmail(email);
  const businessId = await findBusinessIdForManagerEmail(email);
  if (!businessId && !existing) return null;

  await createOrLinkUser({
    email,
    displayName:
      decoded.name ||
      existing?.displayName ||
      email.split("@")[0],
    primaryRole: existing?.primaryRole ?? "business_admin",
    createdBy: "system-auto-provision",
    businessId: businessId,
    membershipRole:
      existing?.primaryRole === "business_viewer"
        ? "business_viewer"
        : "business_admin",
    source: "invite",
  });

  return loadAuthenticatedUser(decoded.uid);
}

export async function beginAdminMfaChallenge(idToken: string): Promise<{
  challengeToken: string;
  email: string;
  otpSent: boolean;
}> {
  const { verifyFirebaseIdToken } = await import("../auth/firebaseAuth");
  const decoded = await verifyFirebaseIdToken(idToken);
  if (!decoded?.uid) {
    throw new Error("Invalid credentials.");
  }

  const user = await resolveUserFromIdToken(idToken)
    ?? (await autoProvisionCompanyManager(idToken));
  if (!user) {
    throw new Error("Admin account not provisioned.");
  }
  if (!isAdminPanelRole(user.primaryRole)) {
    throw new Error("Invalid credentials.");
  }
  if (user.status === "suspended" || user.status === "revoked") {
    throw new Error("Invalid credentials.");
  }

  const email = normalizeEmail(user.email);
  let businessId = primaryBusinessId(user);
  if (
    (user.primaryRole === "business_admin" ||
      user.primaryRole === "business_viewer") &&
    !businessId
  ) {
    businessId = await findBusinessIdForManagerEmail(email);
    if (businessId) {
      await createOrLinkUser({
        email,
        displayName: user.displayName || email.split("@")[0],
        primaryRole: user.primaryRole,
        createdBy: "system-auto-provision",
        businessId,
        membershipRole: user.primaryRole,
        source: "invite",
      });
      const linked = await loadAuthenticatedUser(user.uid);
      businessId = linked ? primaryBusinessId(linked) : businessId;
    }
  }

  if (
    (user.primaryRole === "business_admin" ||
      user.primaryRole === "business_viewer") &&
    !businessId
  ) {
    throw new Error("Invalid credentials.");
  }

  if (businessId) {
    const businessDoc = await db.collection(COLLECTIONS.businesses).doc(businessId).get();
    const status = businessDoc.data()?.status as string | undefined;
    if (!businessDoc.exists || (status && status !== "active")) {
      throw new Error("Invalid credentials.");
    }
  }

  await sendAdminEmailOtp(email);
  const challengeToken = signAdminMfaChallengeToken(
    user.uid,
    email,
    user.primaryRole as AdminPanelRole,
    businessId
  );

  return { challengeToken, email, otpSent: true };
}

export async function sendAdminEmailOtp(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Invalid credentials.");
  }

  await consumeRateLimit(`admin-otp:${normalized}`, 5, 15 * 60 * 1000);

  const ref = db.collection(COLLECTIONS.adminOtp).doc(otpDocId(normalized));
  const existing = await ref.get();
  const now = Date.now();
  if (existing.exists) {
    const lastSentAt = existing.data()?.lastSentAt as number | undefined;
    if (lastSentAt && now - lastSentAt < RESEND_COOLDOWN_MS) {
      throw new Error("Please wait before requesting another code.");
    }
  }

  const code = `${randomInt(0, 1_000_000)}`.padStart(6, "0");
  const salt = `${now}-${randomInt(1000, 9999)}`;

  await ref.set({
    email: normalized,
    codeHash: hashOtp(code, salt),
    salt,
    attempts: 0,
    expiresAt: now + OTP_TTL_MS,
    lastSentAt: now,
    consumed: false,
  });

  try {
    await sendSupportMail({
      to: normalized,
      subject: "Your TRDDK admin verification code",
      text:
        `Your TRDDK admin verification code is ${code}.\n\n` +
        "It expires in 8 minutes. If you did not request this, ignore this email.",
    });
  } catch (error) {
    const category = (error as Error).message;
    console.error("admin OTP email failed", { email: normalized, category });
    if (
      category === "secret not bound" ||
      category === "invalid SMTP credentials" ||
      category === "Gmail authentication rejected" ||
      category === "sender mismatch" ||
      category === "network/port error" ||
      category === "smtp delivery failed"
    ) {
      throw new Error(category);
    }
    throw new Error("Email delivery is not configured. Contact support.");
  }
}

export async function verifyAdminEmailOtp(
  challengeToken: string,
  code: string
): Promise<{ sessionToken: string; user: Record<string, unknown> }> {
  const challenge = parseAdminMfaChallengeToken(challengeToken);
  if (!challenge) {
    throw new Error("Session expired. Sign in again.");
  }

  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    throw new Error("Enter the 6-digit code.");
  }

  const ref = db.collection(COLLECTIONS.adminOtp).doc(otpDocId(challenge.email));
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Invalid or expired code.");
  }

  const data = snap.data()!;
  const now = Date.now();
  if (data.consumed || now > (data.expiresAt as number)) {
    throw new Error("Invalid or expired code.");
  }
  if ((data.attempts as number) >= MAX_ATTEMPTS) {
    throw new Error("Too many attempts. Request a new code.");
  }

  const expected = data.codeHash as string;
  const actual = hashOtp(trimmed, data.salt as string);
  if (actual !== expected) {
    await ref.update({ attempts: (data.attempts as number) + 1 });
    throw new Error("Invalid or expired code.");
  }

  await ref.update({ consumed: true, verifiedAt: now });

  const loaded = await loadAuthenticatedUser(challenge.uid);
  if (!loaded) {
    throw new Error("Invalid credentials.");
  }

  await recordLogin(challenge.uid);

  const sessionToken = signAdminSessionToken(
    challenge.uid,
    challenge.email,
    challenge.role,
    challenge.businessId,
    loaded.displayName
  );

  return {
    sessionToken,
    user: {
      userId: challenge.uid,
      name: loaded.displayName,
      email: challenge.email,
      phone: challenge.email,
      role: challenge.role,
      businessId: challenge.businessId,
      authSource: "admin_mfa",
      mfaCompleted: true,
    },
  };
}

export async function resendAdminMfaOtp(challengeToken: string): Promise<void> {
  const challenge = parseAdminMfaChallengeToken(challengeToken);
  if (!challenge) {
    throw new Error("Session expired. Sign in again.");
  }
  await sendAdminEmailOtp(challenge.email);
}
