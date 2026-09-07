import { COLLECTIONS } from "@tardadi/shared";
import type { Bus, Driver, Route, Stop } from "@tardadi/shared";
import { db } from "../firebase";
import { withBusinessId } from "../auth/scope";
import { businessRef } from "../business/helpers";

export interface DriverSessionPayload {
  driver: Driver;
  bus: Bus;
  route: Route;
  stops: Stop[];
  tripId: string | null;
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

  return { driver, bus, route, stops, tripId };
}

/** @deprecated Phone login — prefer Firebase email session. */
export async function loadDriverSessionByPhone(
  orgId: string,
  phone: string,
  normalizePhone: (phone: string) => string
): Promise<DriverSessionPayload> {
  const normalizedPhone = normalizePhone(phone);

  const driversSnapshot = await businessRef(db, orgId)
    .collection(COLLECTIONS.drivers)
    .where("phone", "==", normalizedPhone)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (driversSnapshot.empty) {
    throw new Error("Phone number is not registered. Contact your employer.");
  }

  return loadDriverSessionFromBusiness(orgId, driversSnapshot.docs[0].id);
}

/** @deprecated Use loadDriverSessionFromBusiness */
export async function loadDriverSession(
  orgId: string,
  driverDocId: string
): Promise<DriverSessionPayload> {
  return loadDriverSessionFromBusiness(orgId, driverDocId);
}
