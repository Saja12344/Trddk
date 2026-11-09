const COMPANY_SCOPED_ROLES = new Set(["business_admin", "business_viewer"]);

export function isCompanyScopedRole(role: string): boolean {
  return COMPANY_SCOPED_ROLES.has(role);
}

/**
 * Company roles always act as the business inside the verified token.
 * Platform roles keep the server-side company context.
 */
export function scopedRequestBusinessId(input: {
  role: string;
  tokenBusinessId: string | null;
  contextBusinessId: string | null;
}): { ok: true; businessId: string | null } | { ok: false } {
  if (isCompanyScopedRole(input.role)) {
    if (!input.tokenBusinessId) return { ok: false };
    return { ok: true, businessId: input.tokenBusinessId };
  }
  return { ok: true, businessId: input.contextBusinessId };
}

/** Block company roles from listing or opening another company's record. */
export function companyBusinessPathAllowed(
  role: string,
  tokenBusinessId: string | null,
  segments: string[]
): boolean {
  if (!isCompanyScopedRole(role)) return true;
  if (segments.length < 2 || segments[0] !== "api" || segments[1] !== "businesses") {
    return true;
  }
  if (!tokenBusinessId || segments.length === 2) return false;
  return segments[2] === tokenBusinessId;
}
