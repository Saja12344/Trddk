import { NextRequest, NextResponse } from "next/server";
import {
  BUSINESS_CONTEXT_COOKIE,
  SESSION_COOKIE,
} from "@/lib/auth.constants";
import { fetchBackend } from "@/lib/backend.server";

const ONE_WEEK = 60 * 60 * 24 * 7;

export async function POST(request: NextRequest) {
  const { idToken } = (await request.json()) as { idToken?: string };
  if (!idToken) {
    return NextResponse.json(
      { success: false, error: "Invalid credentials." },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetchBackend("/api/auth/admin-mfa-challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "تعذّر الاتصال بالخادم." },
      { status: 502 }
    );
  }

  const payload = (await upstream.json()) as {
    success: boolean;
    data?: { challengeToken: string; email: string };
    error?: string;
  };

  if (!upstream.ok || !payload.success || !payload.data?.challengeToken) {
    return NextResponse.json(
      { success: false, error: payload.error || "Invalid credentials." },
      { status: upstream.status || 401 }
    );
  }

  return NextResponse.json({ success: true, data: payload.data });
}
