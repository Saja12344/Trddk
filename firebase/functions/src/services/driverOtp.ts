import { createHash, randomInt } from "crypto";
import { COLLECTIONS, normalizePhone } from "@tardadi/shared";
import { db } from "../firebase";
import { driverStartDelivery } from "../auth/driverAccess";
import { consumeRateLimit } from "../auth/rateLimit";
import { sendSms } from "../auth/sms";
import { loadDriverSessionByPhone } from "./driverSession";
import { isDriverStoreReviewPhone } from "./driverReview";
import { isStoreReviewPhone } from "./passengerReview";

const OTP_TTL_MS = 8 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export const SMS_PROVIDER_MISSING = "تعذّر إرسال رمز التحقق.";

export function smsProviderConfigured(): boolean {
  return Boolean(
    process.env.TAQNYAT_API_KEY?.trim() ||
      (process.env.MSEGAT_API_KEY?.trim() && process.env.MSEGAT_USER?.trim()) ||
      process.env.SMS_WEBHOOK_URL?.trim()
  );
}

function hashOtp(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function otpDocId(phone: string): string {
  return createHash("sha256").update(normalizePhone(phone)).digest("hex");
}

export async function sendDriverPhoneOtp(
  orgId: string,
  phone: string
): Promise<{ sent: true }> {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new Error("اكتب رقم الجوال.");
  }

  const rate = consumeRateLimit(`driver-otp:${normalized}`, 8, 15 * 60 * 1000);
  if (!rate.allowed) {
    throw new Error("محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.");
  }

  const reviewPhone =
    isStoreReviewPhone(normalized) || isDriverStoreReviewPhone(normalized);
  if (!reviewPhone && !smsProviderConfigured()) {
    throw new Error(SMS_PROVIDER_MISSING);
  }

  let registeredActiveAssigned = false;
  if (!reviewPhone) {
    try {
      await loadDriverSessionByPhone(orgId, phone, normalizePhone);
      registeredActiveAssigned = true;
    } catch {
      registeredActiveAssigned = false;
    }
  }
  if (!driverStartDelivery(registeredActiveAssigned).deliverSms) {
    return { sent: true };
  }

  const ref = db.collection(COLLECTIONS.driverOtp).doc(otpDocId(normalized));
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
      `رمز دخول تطبيق سائق TRDDK هو ${code}. صالح لثماني دقائق.`
    );
  } catch {
    await ref.delete();
    return { sent: true };
  }

  return { sent: true };
}

export async function verifyDriverPhoneOtp(
  orgId: string,
  phone: string,
  code: string
) {
  const normalized = normalizePhone(phone);
  const trimmed = code.trim();
  const verifyRate = consumeRateLimit(
    `driver-otp-verify:${normalized || "invalid"}`,
    10,
    15 * 60 * 1000
  );
  if (!verifyRate.allowed) {
    throw new Error("محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.");
  }
  if (!/^\d{6}$/.test(trimmed)) {
    throw new Error("أدخل رمز التحقق المكوّن من 6 أرقام.");
  }

  const ref = db.collection(COLLECTIONS.driverOtp).doc(otpDocId(normalized));
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("رمز غير صحيح أو منتهي.");
  }

  const data = snap.data()!;
  const now = Date.now();
  if (data.consumed || now > (data.expiresAt as number)) {
    throw new Error("رمز غير صحيح أو منتهي.");
  }
  if ((data.attempts as number) >= MAX_ATTEMPTS) {
    throw new Error("محاولات كثيرة. اطلب رمزاً جديداً.");
  }

  const expected = data.codeHash as string;
  const actual = hashOtp(trimmed, data.salt as string);
  if (actual !== expected) {
    await ref.update({ attempts: (data.attempts as number) + 1 });
    throw new Error("رمز غير صحيح أو منتهي.");
  }

  await ref.update({ consumed: true, verifiedAt: now });
  return loadDriverSessionByPhone(orgId, phone, normalizePhone);
}
