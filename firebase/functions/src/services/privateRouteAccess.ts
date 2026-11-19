export type PrivateRouteDecision =
  | { allowed: true }
  | { allowed: false; status: 403 };

/** Private routes stay visible to the company admin and to a passenger session of that company. */
export function decidePrivateRouteAccess(input: {
  accessMode?: string | null;
  isAdmin: boolean;
  passengerBusinessId?: string | null;
  routeBusinessId: string;
  membershipAllowsPassenger: boolean;
}): PrivateRouteDecision {
  if (input.accessMode !== "private") return { allowed: true };
  if (input.isAdmin) return { allowed: true };
  if (
    input.passengerBusinessId &&
    input.passengerBusinessId === input.routeBusinessId &&
    input.membershipAllowsPassenger
  ) {
    return { allowed: true };
  }
  return { allowed: false, status: 403 };
}
