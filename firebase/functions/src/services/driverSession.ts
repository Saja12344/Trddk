import { COLLECTIONS } from "@tardadi/shared";
import type { Bus, Driver, Route, Stop } from "@tardadi/shared";
import { db } from "../firebase";
import { signDriverSessionToken } from "../auth/driverAccess";
import { withBusinessId } from "../auth/scope";
import { businessRef } from "../business/helpers";
import { translateNames, withTranslatedNames } from "./translate";

export interface DriverSessionPayload {
  driver: Driver;
  bus: Bus;
  route: Route;
  stops: Stop[];
  tripId: string | null;
  sessionToken: string;
}

export async function loadDriverSessionFromBusiness(
  businessId: string,
  driverDocId: string
): Promise<DriverSessionPayload> {
  const driverDoc = await businessRef(db, businessId)
    .collection(COLLECTIONS.drivers)
    .doc(driverDocId)
    .get();

  if (!driverDoc.exists) {
    throw new Error("Driver profile not found. Contact your employer.");
  }

  const driverData = driverDoc.data()!;
  if (driverData.status !== "active") {
    throw new Error("Driver account is inactive. Contact your employer.");
  }

  const driver: Driver = withBusinessId(businessId, {
    driverId: driverDoc.id,
    name: driverData.name,
    phone: driverData.phone,
    driverCode: driverData.driverCode,
    assignedRouteId: driverData.assignedRouteId,
    assignedBusId: driverData.assignedBusId,
    status: driverData.status,
  }) as Driver;

  if (!driver.assignedRouteId || !driver.assignedBusId) {
    throw new Error("Route or bus is not assigned yet. Contact your employer.");
  }

  const busDoc = await businessRef(db, businessId)
    .collection(COLLECTIONS.buses)
    .doc(driver.assignedBusId)
    .get();

  if (!busDoc.exists) {
    throw new Error("Assigned bus not found.");
  }

  const bus: Bus = withBusinessId(businessId, {
    busId: busDoc.id,
    ...(busDoc.data() as Omit<Bus, "busId" | "businessId" | "organizationId">),
  }) as Bus;

  const routeDoc = await businessRef(db, businessId)
    .collection(COLLECTIONS.routes)
    .doc(driver.assignedRouteId)
    .get();

  if (!routeDoc.exists) {
    throw new Error("Assigned route not found.");
  }

  const route: Route = withBusinessId(businessId, {
    routeId: routeDoc.id,
    ...(routeDoc.data() as Omit<Route, "routeId" | "businessId" | "organizationId">),
  }) as Route;

  const stopsSnapshot = await routeDoc.ref
    .collection(COLLECTIONS.stops)
    .orderBy("sequenceNo")
    .get();

  const stops: Stop[] = stopsSnapshot.docs.map((doc) => ({
    stopId: doc.id,
    routeId: route.routeId,
    ...(doc.data() as Omit<Stop, "stopId" | "routeId">),
  }));

  const activeTripSnapshot = await businessRef(db, businessId)
    .collection(COLLECTIONS.trips)
    .where("busId", "==", driver.assignedBusId)
    .where("tripStatus", "==", "active")
    .limit(1)
    .get();

  const tripId = activeTripSnapshot.empty
    ? null
    : activeTripSnapshot.docs[0].id;

  const [translatedRoute] = await withTranslatedNames([
    route as unknown as Record<string, unknown>,
  ]);
  const translatedStops = await withTranslatedNames(
    stops as unknown as Record<string, unknown>[]
  );
  const names = await translateNames([driver.name, bus.label]);
  const driverNames = names.get(driver.name.trim());
  const busNames = names.get(bus.label.trim());

  return {
    driver: {
      ...driver,
      nameAr: driverNames?.ar,
      nameEn: driverNames?.en,
    } as Driver,
    bus: {
      ...bus,
      labelAr: busNames?.ar,
      labelEn: busNames?.en,
    } as Bus,
    route: translatedRoute as unknown as Route,
    stops: translatedStops as unknown as Stop[],
    tripId,
    sessionToken: signDriverSessionToken(
      driver.driverId,
      businessId,
      driver.name
    ),
  };
}

function phoneCandidates(
  phone: string,
  normalizePhone: (value: string) => string
): string[] {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  const values = new Set<string>([trimmed, normalizePhone(trimmed)]);
  if (digits) values.add(digits);
  if (digits.startsWith("966")) values.add(`+${digits}`);
  if (digits.startsWith("05") && digits.length === 10) {
    values.add(`+966${digits.slice(1)}`);
  }
  if (digits.startsWith("5") && digits.length === 9) {
    values.add(`+966${digits}`);
  }
  return [...values].filter(Boolean);
}

async function findActiveDriverByPhone(
  phone: string,
  normalizePhone: (phone: string) => string,
  preferredBusinessId?: string
): Promise<{ businessId: string; driverId: string }> {
  const candidates = phoneCandidates(phone, normalizePhone);

  const lookupInBusiness = async (businessId: string) => {
    const col = businessRef(db, businessId).collection(COLLECTIONS.drivers);
    for (const candidate of candidates) {
      const snapshot = await col.where("phone", "==", candidate).limit(5).get();
      const match = snapshot.docs.find((doc) => {
        const status = doc.data().status as string | undefined;
        return !status || status === "active";
      });
      if (match) return { businessId, driverId: match.id };
    }
    return null;
  };

  const preferred =
    preferredBusinessId && preferredBusinessId !== "demo-org"
      ? preferredBusinessId
      : undefined;
  if (preferred) {
    const found = await lookupInBusiness(preferred);
    if (found) return found;
  }

  const businesses = await db.collection(COLLECTIONS.businesses).get();
  for (const biz of businesses.docs) {
    if (biz.id === preferred) continue;
    const found = await lookupInBusiness(biz.id);
    if (found) return found;
  }

  throw new Error("Phone number is not registered. Contact your employer.");
}

/** Phone login for the driver app — looks up the registered driver by mobile number. */
export async function loadDriverSessionByPhone(
  orgId: string,
  phone: string,
  normalizePhone: (phone: string) => string
): Promise<DriverSessionPayload> {
  const found = await findActiveDriverByPhone(phone, normalizePhone, orgId);
  return loadDriverSessionFromBusiness(found.businessId, found.driverId);
}

/** @deprecated Use loadDriverSessionFromBusiness */
export async function loadDriverSession(
  orgId: string,
  driverDocId: string
): Promise<DriverSessionPayload> {
  return loadDriverSessionFromBusiness(orgId, driverDocId);
}
