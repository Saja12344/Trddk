/**
 * Server-side fetch to Cloud Run / Cloud Functions with optional IAM identity token.
 */
import { getServerApiUrl } from "./env.server";

let cachedAuth: { expiresAt: number; headers: Record<string, string> } | null =
  null;

function parseServiceAccountJson(): Record<string, unknown> | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error("[backend] GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON");
    return null;
  }
}

export async function getBackendAuthHeaders(): Promise<Record<string, string>> {
  const credentials = parseServiceAccountJson();
  const now = Date.now();
  if (cachedAuth && cachedAuth.expiresAt > now + 60_000) {
    return cachedAuth.headers;
  }

  const { GoogleAuth } = await import("google-auth-library");
  const targetAudience = getServerApiUrl();
  const auth = credentials
    ? new GoogleAuth({ credentials })
    : new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });

  try {
    const client = await auth.getIdTokenClient(targetAudience);
    const headers = await client.getRequestHeaders(targetAudience);
    const normalized = Object.fromEntries(headers.entries());
    cachedAuth = {
      headers: normalized,
      expiresAt: now + 50 * 60_000,
    };
    return normalized;
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      console.error("[backend] failed to mint Cloud Run identity token", {
        message: error instanceof Error ? error.message : "unknown",
      });
    }
    return {};
  }
}

export async function fetchBackend(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const apiUrl = getServerApiUrl().replace(/\/$/, "");
  const url = path.startsWith("http") ? path : `${apiUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(init.headers);
  const authHeaders = await getBackendAuthHeaders();
  for (const [key, value] of Object.entries(authHeaders)) {
    if (!headers.has(key)) headers.set(key, value);
  }

  return fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });
}
