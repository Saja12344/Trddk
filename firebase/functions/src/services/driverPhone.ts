import { normalizePhone } from "@tardadi/shared";

export interface DriverPhoneOwner {
  businessId: string;
  driverId: string;
  name: string;
  phone: string;
}

/**
 * A new driver cannot take a phone that already belongs to a driver in
 * another company. The two drivers who already share a phone may keep it.
 */
export function driverPhoneConflict(input: {
  normalizedPhone: string;
  owners: DriverPhoneOwner[];
  businessId: string;
  driverId?: string | null;
  previousPhone?: string | null;
}): { ok: true } | { ok: false; message: string } {
  const grandfather =
    Boolean(input.driverId) &&
    Boolean(input.previousPhone) &&
    normalizePhone(input.previousPhone as string) === input.normalizedPhone;

  for (const owner of input.owners) {
    if (owner.businessId === input.businessId && owner.driverId === input.driverId) {
      continue;
    }
    if (owner.businessId === input.businessId) {
      return { ok: false, message: "رقم الجوال مسجل مسبقاً" };
    }
    if (grandfather && normalizePhone(owner.phone) === input.normalizedPhone) {
      continue;
    }
    const name = owner.name?.trim() || "سائق آخر";
    return {
      ok: false,
      message: `الرقم مستخدم للسائق ${name} في شركة أخرى.`,
    };
  }
  return { ok: true };
}
