import type { BusinessMembership } from "@tardadi/shared";

/** Whether membership grants passenger app access (company-scoped). */
export function resolvesPassengerAccess(m: BusinessMembership): boolean {
  if (m.passengerAccess === true) return true;
  if (m.passengerAccess === false) return false;
  // Legacy employee invites before passengerAccess was stored explicitly.
  return m.role === "employee";
}

export function membershipAllowsPassenger(m: BusinessMembership): boolean {
  if (m.status !== "active" && m.status !== "pending") return false;
  return resolvesPassengerAccess(m);
}
