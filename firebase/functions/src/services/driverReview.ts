import { timingSafeEqual } from "crypto";
import { normalizePhone } from "@tardadi/shared";
import { signDriverSessionToken } from "../auth/driverAccess";
import { withBusinessId } from "../auth/scope";
import type { DriverSessionPayload } from "./driverSession";

/** Store-review driver line. One digit apart from the passenger review number. */
export const STORE_DRIVER_REVIEW_PHONE = "+966500300002";

const DEFAULT_DRIVER_REVIEW_OTP = "84729164";

export function isDriverStoreReviewPhone(phone: string): boolean {
  return normalizePhone(phone) === STORE_DRIVER_REVIEW_PHONE;
}

/** Eight-digit driver review code. Env overrides the reviewer default. */
export function expectedDriverReviewOtp(): string | null {
  const fromEnv = process.env.DRIVER_REVIEW_OTP?.trim();
  if (fromEnv && /^\d{8}$/.test(fromEnv)) return fromEnv;
  return DEFAULT_DRIVER_REVIEW_OTP;
}

export function driverReviewLoginDecision(
  phone: string,
  code: string
): { ok: true; phone: string } | { ok: false } {
  if (!isDriverStoreReviewPhone(phone)) return { ok: false };

  const expected = expectedDriverReviewOtp();
  if (!expected) return { ok: false };
  const trimmed = code.trim();
  if (trimmed.length !== expected.length) return { ok: false };

  const given = Buffer.from(trimmed);
  const wanted = Buffer.from(expected);
  if (!timingSafeEqual(given, wanted)) return { ok: false };

  return { ok: true, phone: STORE_DRIVER_REVIEW_PHONE };
}

/** A self-contained session. It does not read company drivers, buses, or routes. */
export function driverReviewSession(phone: string): DriverSessionPayload {
  const businessId = "store-review";
  const driver = withBusinessId(businessId, {
    driverId: "store-review-driver",
    name: "Store review",
    nameAr: "مراجعة المتجر",
    nameEn: "Store review",
    phone,
    driverCode: "REVIEW",
    assignedRouteId: "store-review-route",
    assignedBusId: "store-review-bus",
    status: "active" as const,
  });
  const bus = withBusinessId(businessId, {
    busId: "store-review-bus",
    plateNo: "REVIEW",
    label: "Review bus",
    labelAr: "باص المراجعة",
    labelEn: "Review bus",
    status: "active" as const,
    currentLocation: { latitude: 24.7136, longitude: 46.6753 },
  });
  const route = withBusinessId(businessId, {
    routeId: "store-review-route",
    name: "Review route",
    nameAr: "مسار المراجعة",
    nameEn: "Review route",
    code: "R-0",
    colorHex: "#EB4F26",
    status: "active" as const,
    accessMode: "public" as const,
    fromLocation: {
      address: "Riyadh",
      addressAr: "الرياض",
      addressEn: "Riyadh",
      latitude: 24.7136,
      longitude: 46.6753,
    },
    toLocation: {
      address: "Diriyah",
      addressAr: "الدرعية",
      addressEn: "Diriyah",
      latitude: 24.7377,
      longitude: 46.575,
    },
  });

  return {
    driver,
    bus,
    route,
    stops: [],
    tripId: null,
    sessionToken: signDriverSessionToken(
      driver.driverId,
      businessId,
      driver.name
    ),
  };
}
