import { createHash, randomInt } from "crypto";
import { COLLECTIONS, normalizePhone, type BusinessMembership } from "@tardadi/shared";
import { db } from "../firebase";
import { consumeRateLimit } from "../auth/rateLimit";
import { sendSms } from "../auth/sms";
import { membershipAllowsPassenger } from "./passengerAccess";
import { isStoreReviewPhone } from "./passengerReview";
import { listPassengerMembershipsByPhone } from "./passengerSession";
import { findFirestoreUsersByPhone } from "./users";
import { SMS_PROVIDER_MISSING, smsProviderConfigured } from "./driverOtp";

const COLLECTION = "passenger_phone_otp";
const OTP_TTL_MS = 8 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const INVALID_CODE = "رمز غير صحيح أو منتهي.";

function hashOtp(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function otpDocId(phone: string): string {
  return createHash("sha256").update(normalizePhone(phone)).digest("hex");
}

async function eligiblePassengerUid(phone: string): Promise<string | null> {
  const users = await findFirestoreUsersByPhone(phone);
  for (const user of users) {
    const snap = await db
      .collection(COLLECTIONS.users)
      .doc(user.uid)
      .collection(COLLECTIONS.memberships)
      .get();
    const allowed = snap.docs.some((doc) => {
      const data = doc.data() as Omit<BusinessMembership, "businessId">;
      return membershipAllowsPassenger({ businessId: doc.id, ...data });
    });
    if (allowed) return user.uid;
  }
  return null;
}

export async function sendPassengerPhoneOtp(phone: string): Promise<{ sent: true }> {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new Error("اكتب رقم الجوال.");
  }

  const rate = consumeRateLimit(`passenger-phone-otp:${normalized}`, 8, 15 * 60 * 1000);
  if (!rate.allowed) {
    throw new Error("محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.");
  }

  if (!isStoreReviewPhone(normalized) && !smsProviderConfigured()) {
    throw new Error(SMS_PROVIDER_MISSING);
  }

  const uid = isStoreReviewPhone(normalized) ? null : await eligiblePassengerUid(normalized);
  if (!uid) return { sent: true };

  const ref = db.collection(COLLECTION).doc(otpDocId(normalized));
  const now = Date.now();
  const existing = await ref.get();
  if (existing.exists) {
    const lastSentAt = existing.data()?.lastSentAt as number | undefined;
    if (lastSentAt && now - lastSentAt < RESEND_COOLDOWN_MS) {
      return { sent: true };
    }
  }

  const code = `${randomInt(0, 1_000_000)}`.padStart(6, "0");
  const salt = `${now}-${randomInt(1000, 9999)}`;
  await ref.set({
    phone: normalized,
    uid,
    codeHash: hashOtp(code, salt),
    salt,
    attempts: 0,
    expiresAt: now + OTP_TTL_MS,
    lastSentAt: now,
    consumed: false,
  });

  try {
    await sendSms(
      normalized,
      `رمز دخول تطبيق TRDDK هو ${code}. صالح لثماني دقائق.`
    );
  } catch {
    await ref.delete();
    return { sent: true };
  }

  return { sent: true };
}

export async function verifyPassengerPhoneOtp(phone: string, code: string) {
  const normalized = normalizePhone(phone);
  const trimmed = code.trim();
  const verifyRate = consumeRateLimit(
    `passenger-phone-otp-verify:${normalized || "invalid"}`,
    10,
    15 * 60 * 1000
  );
  if (!verifyRate.allowed) {
    throw new Error("محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.");
  }
  if (!/^\d{6}$/.test(trimmed)) {
    throw new Error("أدخل رمز التحقق المكوّن من 6 أرقام.");
  }

  const ref = db.collection(COLLECTION).doc(otpDocId(normalized));
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(INVALID_CODE);
  }

  const data = snap.data()!;
  const now = Date.now();
  if (data.consumed || now > (data.expiresAt as number)) {
    throw new Error(INVALID_CODE);
  }
  if ((data.attempts as number) >= MAX_ATTEMPTS) {
    throw new Error("محاولات كثيرة. اطلب رمزاً جديداً.");
  }

  const expected = data.codeHash as string;
  const actual = hashOtp(trimmed, data.salt as string);
  if (actual !== expected) {
    await ref.update({ attempts: (data.attempts as number) + 1 });
    throw new Error(INVALID_CODE);
  }

  const uid = data.uid as string | undefined;
  if (!uid) {
    throw new Error(INVALID_CODE);
  }

  await ref.update({ consumed: true, verifiedAt: now });
  const result = await listPassengerMembershipsByPhone(uid, normalized);
  return { verified: true, ...result };
}
