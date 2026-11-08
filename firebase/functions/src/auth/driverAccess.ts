import type { Request } from "express";
import { getJwtSecret, signJwt, verifyJwt } from "./crypto";
import { hashToken } from "./rateLimit";

export const DRIVER_SESSION_ROLE = "driver_session";
export const DRIVER_LOGIN_DENIED = "تعذّر تسجيل الدخول.";
const DRIVER_SESSION_TTL_SEC = 60 * 60 * 24 * 7;

export interface DriverAuthContext {
  driverId: string;
  businessId: string;
  name: string;
}

export interface PassengerSessionAuth {
  userId: string;
  businessId: string;
}

declare global {
  namespace Express {
    interface Request {
      driverAuth?: DriverAuthContext | null;
      passengerSession?: PassengerSessionAuth | null;
    }
  }
}

export function driverLoginDecision(
  idToken: unknown
): { ok: true; idToken: string } | { ok: false; status: 401; error: string } {
  if (typeof idToken !== "string" || !idToken.trim()) {
    return { ok: false, status: 401, error: DRIVER_LOGIN_DENIED };
  }
  return { ok: true, idToken: idToken.trim() };
}

/** Same public response whether or not a driver record exists. */
export function driverStartDelivery(registeredActiveAssigned: boolean): {
  sent: true;
  deliverSms: boolean;
} {
  return { sent: true, deliverSms: registeredActiveAssigned };
}

export function signDriverSessionToken(
  driverId: string,
  businessId: string,
  name: string
): string {
  return signJwt(
    {
      sub: driverId,
      role: DRIVER_SESSION_ROLE,
      businessId,
      name,
      phone: "",
    },
    getJwtSecret(),
    DRIVER_SESSION_TTL_SEC
  );
}

export function parseDriverSessionToken(token: string): DriverAuthContext | null {
  const payload = verifyJwt(token, getJwtSecret());
  if (!payload || payload.role !== DRIVER_SESSION_ROLE) return null;
  if (!payload.sub || !payload.businessId) return null;
  return {
    driverId: payload.sub,
    businessId: payload.businessId,
    name: payload.name,
  };
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export function clientRateKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = (raw?.split(",")[0] || req.ip || "unknown").trim();
  return hashToken(ip);
}

export function requestedBusinessId(req: Request): string | null {
  const values = [
    req.query.businessId,
    req.query.organizationId,
    req.body?.businessId,
    req.body?.organizationId,
  ];
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function scopedBusinessId(
  tokenBusinessId: string | null | undefined,
  requested: string | null | undefined
): { ok: true; businessId: string } | { ok: false; status: 403 | 401 } {
  if (!tokenBusinessId) return { ok: false, status: 401 };
  if (requested && requested !== tokenBusinessId) return { ok: false, status: 403 };
  return { ok: true, businessId: tokenBusinessId };
}

export function assertBodyDriver(
  tokenDriverId: string,
  bodyDriverId: unknown
): { ok: true } | { ok: false; status: 403 } {
  if (bodyDriverId == null || bodyDriverId === "") return { ok: true };
  if (String(bodyDriverId) !== tokenDriverId) return { ok: false, status: 403 };
  return { ok: true };
}

export function driverMayStartTrip(
  assignedBusId: string | null | undefined,
  assignedRouteId: string | null | undefined,
  busId: string,
  routeId: string
): boolean {
  return Boolean(
    assignedBusId &&
      assignedRouteId &&
      assignedBusId === busId &&
      assignedRouteId === routeId
  );
}

export function tripMatchesActor(
  trip: { driverId?: string; busId?: string },
  driverId: string,
  busId?: string
): boolean {
  if (trip.driverId !== driverId) return false;
  if (busId != null && trip.busId !== busId) return false;
  return true;
}

export function reminderOwner(
  tokenUserId: string,
  bodyUserId: unknown
): { ok: true; userId: string } | { ok: false; status: 403 } {
  if (bodyUserId == null || bodyUserId === "") {
    return { ok: true, userId: tokenUserId };
  }
  if (String(bodyUserId) !== tokenUserId) return { ok: false, status: 403 };
  return { ok: true, userId: tokenUserId };
}

export function pickAllowedFields(
  body: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  for (const key of keys) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  return updates;
}

export const BUS_WRITE_FIELDS = ["plateNo", "label", "status"] as const;
export const DRIVER_WRITE_FIELDS = [
  "name",
  "phone",
  "assignedRouteId",
  "assignedBusId",
  "status",
  "driverCode",
] as const;
export const ROUTE_WRITE_FIELDS = [
  "name",
  "code",
  "colorHex",
  "status",
  "accessMode",
  "polyline",
  "fromLocation",
  "toLocation",
] as const;
