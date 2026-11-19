import type { NextFunction, Request, Response } from "express";
import { roleHasPermission } from "@tardadi/shared";
import { HttpError, parseAdminAuth } from "./middleware";
import {
  assertBodyDriver,
  bearerToken,
  parseDriverSessionToken,
  requestedBusinessId,
  scopedBusinessId,
} from "./driverAccess";
import { COLLECTIONS } from "@tardadi/shared";
import { db } from "../firebase";
import { businessRef } from "../business/helpers";
import { isReviewDriverIdentity } from "../services/accountDeletion";
import { parsePassengerSessionToken } from "../services/passengerSession";

const LOGIN_REQUIRED = "يجب تسجيل الدخول للوصول لهذا الطلب.";
const FORBIDDEN = "ليس لديك صلاحية لهذا الإجراء.";

export interface TripActor {
  businessId: string;
  driverId: string;
  isDriver: boolean;
}

function deny(res: Response, status: number, error: string): void {
  res.status(status).json({ success: false, error });
}

export async function requireTripWriter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = bearerToken(req);
  const driver = token ? parseDriverSessionToken(token) : null;
  if (driver) {
    if (!isReviewDriverIdentity(driver.driverId, driver.businessId)) {
      const snap = await businessRef(db, driver.businessId)
        .collection(COLLECTIONS.drivers)
        .doc(driver.driverId)
        .get();
      if (!snap.exists || snap.data()?.status === "deleted") {
        deny(res, 401, LOGIN_REQUIRED);
        return;
      }
    }
    req.driverAuth = driver;
    next();
    return;
  }

  const auth = req.adminAuth ?? parseAdminAuth(req);
  if (!auth) {
    deny(res, 401, LOGIN_REQUIRED);
    return;
  }
  if (!roleHasPermission(auth.role, "trips:write")) {
    deny(res, 403, FORBIDDEN);
    return;
  }
  req.adminAuth = auth;
  req.driverAuth = null;
  next();
}

export function resolveTripActor(req: Request): TripActor {
  if (req.driverAuth) {
    const scoped = scopedBusinessId(
      req.driverAuth.businessId,
      requestedBusinessId(req)
    );
    if (!scoped.ok) {
      throw new HttpError("لا يمكنك الوصول لبيانات شركة أخرى.", scoped.status);
    }
    const matches = assertBodyDriver(req.driverAuth.driverId, req.body?.driverId);
    if (!matches.ok) {
      throw new HttpError("Trip does not belong to this driver", 403);
    }
    return {
      businessId: scoped.businessId,
      driverId: req.driverAuth.driverId,
      isDriver: true,
    };
  }

  const auth = req.adminAuth ?? parseAdminAuth(req);
  if (!auth) {
    throw new HttpError(LOGIN_REQUIRED, 401);
  }
  const requested = requestedBusinessId(req);
  if (auth.role === "business_admin") {
    if (!auth.businessId || (requested && requested !== auth.businessId)) {
      throw new HttpError("لا يمكنك الوصول لبيانات شركة أخرى.", 403);
    }
    return {
      businessId: auth.businessId,
      driverId: String(req.body?.driverId ?? ""),
      isDriver: false,
    };
  }
  if (!requested) {
    throw new HttpError("حدّد الشركة أولاً.", 400);
  }
  return {
    businessId: requested,
    driverId: String(req.body?.driverId ?? ""),
    isDriver: false,
  };
}

export function requireReminderWriter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = bearerToken(req);
  const passenger = token ? parsePassengerSessionToken(token) : null;
  if (passenger?.businessId) {
    req.passengerSession = {
      userId: passenger.sub,
      businessId: passenger.businessId,
    };
    next();
    return;
  }

  const auth = req.adminAuth ?? parseAdminAuth(req);
  if (!auth) {
    deny(res, 401, LOGIN_REQUIRED);
    return;
  }
  if (!roleHasPermission(auth.role, "trips:write")) {
    deny(res, 403, FORBIDDEN);
    return;
  }
  req.adminAuth = auth;
  req.passengerSession = null;
  next();
}
