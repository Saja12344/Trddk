import { createHash, randomInt } from "crypto";
import { COLLECTIONS } from "@tardadi/shared";
import { db } from "../firebase";
import { sendSupportMail } from "../auth/mail";
import { consumeRateLimit } from "../auth/rateLimit";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export function shouldThrottleOtpResend(
  lastSentAt: number | undefined,
  now: number,
  cooldownMs = RESEND_COOLDOWN_MS
): boolean {
  return Boolean(lastSentAt && now - lastSentAt < cooldownMs);
}

export type SendPassengerOtpResult = {
  sent: boolean;
  throttled: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashOtp(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function otpDocId(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export async function sendPassengerEmailOtp(
  email: string
): Promise<SendPassengerOtpResult> {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Enter a valid email address.");
  }

  const rate = consumeRateLimit(`passenger-otp:${normalized}`, 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    return { sent: false, throttled: true };
  }

  const ref = db.collection(COLLECTIONS.passengerOtp).doc(otpDocId(normalized));
  const now = Date.now();
  let sendPayload: {
    code: string;
    salt: string;
    expiresAt: number;
  } | null = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const lastSentAt = snap.data()?.lastSentAt as number | undefined;
      if (shouldThrottleOtpResend(lastSentAt, now)) {
        return;
      }
    }

    const code = `${randomInt(0, 1_000_000)}`.padStart(6, "0");
    const salt = `${now}-${randomInt(1000, 9999)}`;
    const payload = {
      code,
      salt,
      expiresAt: now + OTP_TTL_MS,
    };
    sendPayload = payload;

    tx.set(ref, {
      email: normalized,
      codeHash: hashOtp(code, salt),
      salt,
      attempts: 0,
      expiresAt: payload.expiresAt,
      lastSentAt: now,
      consumed: false,
    });
  });

  if (!sendPayload) {
    return { sent: false, throttled: true };
  }

  const { code: otpCode } = sendPayload;

  try {
    await sendSupportMail({
      to: normalized,
      subject: "Your TRDDK verification code",
      text:
        `Your TRDDK verification code is ${otpCode}.\n\n` +
        "It expires in 10 minutes. If you did not request this, ignore this email.",
    });
  } catch (error) {
    console.error("passenger OTP email failed", {
      email: normalized,
      error: (error as Error).message,
    });
    throw new Error(
      "Email delivery is not configured. Contact support or try again later."
    );
  }

  return { sent: true, throttled: false };
}

export async function verifyPassengerEmailOtp(
  email: string,
  code: string,
  options?: { requireBusinessMembership?: boolean }
): Promise<{
  verified: true;
  verificationToken?: string;
  memberships?: import("./passengerSession").PassengerMembershipSummary[];
  uid?: string;
  accountPending?: boolean;
}> {
  const normalized = normalizeEmail(email);
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    throw new Error("Enter the 6-digit code.");
  }

  const ref = db.collection(COLLECTIONS.passengerOtp).doc(otpDocId(normalized));
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

  if (options?.requireBusinessMembership) {
    const {
      activatePassengerAccess,
      listPassengerMemberships,
      resolvePassengerUserByEmail,
      signPassengerVerificationToken,
    } = await import("./passengerSession");
    const user = await resolvePassengerUserByEmail(normalized);
    const memberships = await listPassengerMemberships(normalized);
    if (!user || memberships.length === 0) {
      throw new Error(
        "هذا البريد غير مسجّل لدى شركتك. تأكد أنك اخترت «أعمال» وليس «شخصي»، أو تواصل مع الإدارة."
      );
    }

    await activatePassengerAccess(
      user.uid,
      memberships.map((m) => m.businessId)
    );

    const activeMemberships = memberships.map((m) => ({
      ...m,
      status: (m.status === "pending" ? "active" : m.status) as typeof m.status,
    }));

    return {
      verified: true,
      verificationToken: signPassengerVerificationToken(normalized, user.uid),
      memberships: activeMemberships,
      uid: user.uid,
      accountPending: false,
    };
  }

  return { verified: true };
}
