import { timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { normalizePhone } from "@tardadi/shared";
import { getJwtSecret, signJwt, verifyJwt } from "../auth/crypto";

/** Store-review passenger line. The code is checked only on the server. */
export const STORE_REVIEW_PHONE = "+966500300001";

const DEFAULT_REVIEW_OTP = "84729163";

export const STORE_REVIEW_ROLE = "passenger_review";

export const STORE_REVIEW_FORBIDDEN =
  "حساب المراجعة لا يصل إلى بيانات الشركات أو المستخدمين.";

const REVIEW_HIDDEN_KEYS = [
  "phone",
  "driverPhone",
  "passengerPhone",
  "email",
  "nationalId",
  "identityNumber",
  "password",
  "fcmToken",
  "token",
] as const;

export function isStoreReviewPhone(phone: string): boolean {
  return normalizePhone(phone) === STORE_REVIEW_PHONE;
}

/** Fixed 8-digit code. An invalid env value falls back to the review code. */
export function expectedReviewOtp(): string {
  const fromEnv = process.env.PASSENGER_REVIEW_OTP?.trim();
  if (fromEnv && /^\d{8}$/.test(fromEnv)) return fromEnv;
  return DEFAULT_REVIEW_OTP;
}

export function reviewLoginDecision(
  phone: string,
  code: string
): { ok: true; phone: string } | { ok: false } {
  if (!isStoreReviewPhone(phone)) return { ok: false };

  const expected = expectedReviewOtp();
  const trimmed = code.trim();
  if (trimmed.length !== expected.length) return { ok: false };

  const given = Buffer.from(trimmed);
  const wanted = Buffer.from(expected);
  if (!timingSafeEqual(given, wanted)) return { ok: false };

  return { ok: true, phone: STORE_REVIEW_PHONE };
}

export function signPassengerReviewToken(phone: string): string {
  return signJwt(
    {
      sub: "passenger-store-review",
      role: STORE_REVIEW_ROLE,
      businessId: null,
      name: "Store review",
      phone,
    },
    getJwtSecret(),
    60 * 60 * 24 * 14
  );
}

export function isPassengerReviewAuthorization(
  header: string | undefined
): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const payload = verifyJwt(header.slice("Bearer ".length).trim(), getJwtSecret());
  return payload?.role === STORE_REVIEW_ROLE && !payload.businessId;
}

export function requestIsPassengerReview(req: Request): boolean {
  const header = req.headers.authorization;
  return isPassengerReviewAuthorization(
    typeof header === "string" ? header : undefined
  );
}

export function rejectStoreReviewAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!requestIsPassengerReview(req)) {
    next();
    return;
  }
  res.status(403).json({ success: false, error: STORE_REVIEW_FORBIDDEN });
}

export function isPublicPassengerRoute(route: {
  status?: string;
  accessMode?: string;
}): boolean {
  return route.status === "active" && route.accessMode !== "private";
}

export function omitReviewPrivateFields<T extends Record<string, unknown>>(
  value: T
): T {
  const copy = { ...value };
  for (const key of REVIEW_HIDDEN_KEYS) {
    delete copy[key];
  }
  return copy;
}
