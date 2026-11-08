import { cookies } from "next/headers";
import type { AdminSession } from "@tardadi/shared";
import {
  BUSINESS_CONTEXT_COOKIE,
  SESSION_COOKIE,
  type SessionPayload,
} from "./auth.constants";
import { getServerApiUrl } from "./env.server";
import { sessionFromAdminCookie } from "./adminSessionToken";

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  return sessionFromAdminCookie(
    raw,
    process.env.ADMIN_JWT_SECRET || process.env.ADMIN_API_TOKEN
  );
}

export async function getBusinessContextId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(BUSINESS_CONTEXT_COOKIE)?.value ?? null;
}

export async function resolveActiveBusinessId(
  session: SessionPayload | null
): Promise<string | null> {
  if (!session) return null;
  if (session.user.role === "business_admin") {
    return session.user.businessId;
  }
  return getBusinessContextId();
}

export async function verifySessionWithBackend(
  session: SessionPayload
): Promise<boolean> {
  try {
    const res = await fetch(
      `${getServerApiUrl()}/api/health`,
      { cache: "no-store" }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export type AuthUser = AdminSession;
