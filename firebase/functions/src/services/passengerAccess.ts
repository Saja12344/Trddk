import type { BusinessMembership } from "@tardadi/shared";

const PANEL_MEMBERSHIP_ROLES = new Set(["business_admin", "business_viewer"]);

/** Whether membership grants passenger app access (company-scoped). */
export function resolvesPassengerAccess(m: BusinessMembership): boolean {
  // Company admins/viewers may use the passenger app for their own company only.
  if (PANEL_MEMBERSHIP_ROLES.has(m.role)) return true;
  if (m.passengerAccess === true) return true;
  if (m.passengerAccess === false) return false;
  // Legacy employee invites before passengerAccess was stored explicitly.
  return m.role === "employee";
}

export function membershipAllowsPassenger(m: BusinessMembership): boolean {
  if (m.status !== "active" && m.status !== "pending") return false;
  return resolvesPassengerAccess(m);
}
