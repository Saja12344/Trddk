import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  normalizePhone,
  phoneCandidates,
  requireSaudiMobile,
} from "@tardadi/shared";
import { businessRef } from "../business/helpers";
import { driverPhoneConflict, type DriverPhoneOwner } from "./driverPhone";
import { decideBusAssignment } from "./driverAssignmentRules";

export class DriverAssignmentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function listDriverOwners(db: Firestore): Promise<DriverPhoneOwner[]> {
  const businesses = await db.collection(COLLECTIONS.businesses).get();
  const owners: DriverPhoneOwner[] = [];
  for (const business of businesses.docs) {
    const drivers = await business.ref.collection(COLLECTIONS.drivers).get();
    for (const driver of drivers.docs) {
      const data = driver.data();
      owners.push({
        businessId: business.id,
        driverId: driver.id,
        name: (data.name as string) || "",
        phone: (data.phone as string) || "",
      });
    }
  }
  return owners;
}

function samePhone(stored: string, normalized: string): boolean {
  return phoneCandidates(stored).some((candidate) => {
    try {
      return normalizePhone(candidate) === normalized || candidate === normalized;
    } catch {
      return candidate === normalized;
    }
  });
}

async function findDriverInBusiness(
  db: Firestore,
  businessId: string,
  normalizedPhone: string,
  driverId?: string | null
) {
  const col = businessRef(db, businessId).collection(COLLECTIONS.drivers);
  if (driverId) {
    const byId = await col.doc(driverId).get();
    if (byId.exists) return byId;
  }
  const all = await col.get();
  return (
    all.docs.find((doc) =>
      samePhone((doc.data().phone as string) || "", normalizedPhone)
    ) ?? null
  );
}

async function busHasActiveTrip(
  db: Firestore,
  businessId: string,
  busId: string
): Promise<boolean> {
  const snap = await businessRef(db, businessId)
    .collection(COLLECTIONS.trips)
    .where("busId", "==", busId)
    .where("tripStatus", "==", "active")
    .limit(1)
    .get();
  return !snap.empty;
}

export async function saveDriverAssignment(
  db: Firestore,
  input: {
    businessId: string;
    name: string;
    phone: string;
    busId?: string | null;
    driverId?: string | null;
    /** Replace the bus's current driver. Refused while that bus has an open trip. */
    replace?: boolean;
    /** Import path: create the driver record even when no bus is chosen. */
    allowUnassigned?: boolean;
  }
): Promise<{ driverId: string; phone: string; routeId: string | null; busId: string | null }> {
  const phone = requireSaudiMobile(input.phone);
  const name = input.name?.trim();
  if (!name) throw new DriverAssignmentError("الاسم مطلوب.");

  const existing = await findDriverInBusiness(
    db,
    input.businessId,
    phone,
    input.driverId
  );
  const existingData = existing?.data() ?? null;
  const existingId = existing?.id ?? null;
  const previousPhone = (existingData?.phone as string | undefined) ?? null;

  const owners = await listDriverOwners(db);
  const conflict = driverPhoneConflict({
    normalizedPhone: phone,
    owners: owners.filter((owner) => samePhone(owner.phone, phone) || normalizePhone(owner.phone) === phone),
    businessId: input.businessId,
    driverId: existingId,
    previousPhone,
  });
  if (!conflict.ok) throw new DriverAssignmentError(conflict.message, 409);

  let routeId: string | null = null;
  let busId: string | null = input.busId?.trim() || null;
  let occupantId: string | null = null;

  if (!busId) {
    if (!input.allowUnassigned && !existingId) {
      throw new DriverAssignmentError("اختر الباص. السائق يُضاف من صفحة الخط.");
    }
  } else {
    const busDoc = await businessRef(db, input.businessId)
      .collection(COLLECTIONS.buses)
      .doc(busId)
      .get();
    if (!busDoc.exists) throw new DriverAssignmentError("الباص غير موجود.", 404);

    const drivers = await businessRef(db, input.businessId)
      .collection(COLLECTIONS.drivers)
      .get();
    const occupant = drivers.docs.find(
      (doc) => doc.data().assignedBusId === busId && doc.id !== existingId
    );
    const activeTrip = await busHasActiveTrip(db, input.businessId, busId);
    const decision = decideBusAssignment({
      busRouteId: (busDoc.data()?.routeId as string | null) ?? null,
      occupantDriverId: occupant?.id ?? null,
      occupantName: (occupant?.data().name as string | undefined) ?? null,
      driverId: existingId,
      activeTrip,
      replace: input.replace === true,
    });
    if (!decision.ok) throw new DriverAssignmentError(decision.message, 409);
    routeId = decision.routeId;
    occupantId = occupant?.id ?? null;
  }

  const now = new Date().toISOString();
  const col = businessRef(db, input.businessId).collection(COLLECTIONS.drivers);
  let driverId = existingId;

  if (!driverId) {
    const created = await col.add({
      name,
      phone,
      driverCode: null,
      assignedRouteId: routeId,
      assignedBusId: busId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    driverId = created.id;
  } else if (busId) {
    await col.doc(driverId).set(
      {
        name,
        phone,
        assignedRouteId: routeId,
        assignedBusId: busId,
        status: "active",
        updatedAt: now,
      },
      { merge: true }
    );
  } else {
    await col.doc(driverId).set({ name, phone, updatedAt: now }, { merge: true });
  }

  if (occupantId && input.replace) {
    await col.doc(occupantId).set(
      { assignedRouteId: null, assignedBusId: null, updatedAt: now },
      { merge: true }
    );
  }

  return { driverId, phone, routeId, busId };
}
