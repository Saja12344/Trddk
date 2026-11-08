import type { AdminSession } from "@tardadi/shared";

const ADMIN_PANEL_ROLES = new Set([
  "super_admin",
  "platform_admin",
  "business_admin",
  "business_viewer",
]);

const INSECURE_JWT_SECRET = "tardadi-dev-jwt-secret-change-in-production";

export interface AdminTokenClaims {
  sub: string;
  role: AdminSession["role"];
  businessId: string | null;
  name: string;
  phone: string;
  mfa: string;
  exp: number;
}

export function usableAdminJwtSecret(secret: string | undefined): string | null {
  const value = secret?.trim() ?? "";
  if (value.length < 32 || value === INSECURE_JWT_SECRET) return null;
  return value;
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function verifyAdminSessionToken(
  token: string,
  secret: string | undefined
): Promise<AdminTokenClaims | null> {
  const keyMaterial = usableAdminJwtSecret(secret);
  if (!keyMaterial) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  if (!header || !body || !signature) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signatureBytes = base64UrlToBytes(signature);
  const signedBytes = new TextEncoder().encode(`${header}.${body}`);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes as BufferSource,
    signedBytes as BufferSource
  );
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as {
      sub?: unknown;
      role?: unknown;
      businessId?: unknown;
      name?: unknown;
      phone?: unknown;
      mfa?: unknown;
      exp?: unknown;
    };
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (payload.mfa !== "1" || typeof payload.role !== "string") return null;
    if (!ADMIN_PANEL_ROLES.has(payload.role)) return null;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    return {
      sub: payload.sub,
      role: payload.role as AdminSession["role"],
      businessId: typeof payload.businessId === "string" ? payload.businessId : null,
      name: typeof payload.name === "string" ? payload.name : "",
      phone: typeof payload.phone === "string" ? payload.phone : "",
      mfa: "1",
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export async function sessionFromAdminCookie(
  raw: string | undefined,
  secret: string | undefined
): Promise<{ token: string; user: AdminSession } | null> {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token?: unknown };
    if (typeof parsed.token !== "string" || !parsed.token) return null;
    const claims = await verifyAdminSessionToken(parsed.token, secret);
    if (!claims) return null;
    return {
      token: parsed.token,
      user: {
        userId: claims.sub,
        name: claims.name,
        phone: claims.phone,
        role: claims.role,
        businessId: claims.businessId,
      },
    };
  } catch {
    return null;
  }
}
