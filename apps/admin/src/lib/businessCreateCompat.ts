import { randomBytes, randomInt } from "crypto";

/** Production functions still require phone + password until they are redeployed. */
export function adaptLegacyCreateBusinessBody(
  body: Record<string, unknown>
): { ok: true; body: Record<string, unknown> } | { ok: false; error: string } {
  const adminName = String(body.adminName ?? "").trim();
  const adminEmail = String(body.adminEmail ?? "").trim();
  if (!adminName || !adminEmail) {
    return { ok: false, error: "اكتب اسم المدير وبريده الإلكتروني." };
  }

  const adapted: Record<string, unknown> = { ...body, adminName, adminEmail };
  if (!String(adapted.adminPassword ?? "").trim()) {
    adapted.adminPassword = `Td${randomBytes(9).toString("base64url")}Aa1!`;
  }
  if (!String(adapted.adminPhone ?? "").trim()) {
    adapted.adminPhone = `05${randomInt(10000000, 99999999)}`;
  }
  return { ok: true, body: adapted };
}

export function createdBusinessId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as {
    data?: { businessId?: string; id?: string };
    businessId?: string;
    id?: string;
  };
  return (
    root.data?.businessId ||
    root.data?.id ||
    root.businessId ||
    root.id ||
    null
  );
}
