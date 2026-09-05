import { NextRequest, NextResponse } from "next/server";
import {
  BUSINESS_CONTEXT_COOKIE,
  SESSION_COOKIE,
} from "@/lib/auth.constants";
import { fetchBackend } from "@/lib/backend.server";

const ONE_WEEK = 60 * 60 * 24 * 7;

export async function POST(request: NextRequest) {
  const { challengeToken, code } = (await request.json()) as {
    challengeToken?: string;
    code?: string;
  };

  if (!challengeToken || !code) {
    return NextResponse.json(
      { success: false, error: "Invalid request." },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetchBackend("/api/auth/admin-mfa-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeToken, code }),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "تعذّر الاتصال بالخادم." },
      { status: 502 }
    );
  }

  const payload = (await upstream.json()) as {
    success: boolean;
    data?: {
      sessionToken: string;
      user: {
        userId: string;
        name: string;
        email: string;
        role: string;
        businessId: string | null;
      };
    };
    error?: string;
  };

  if (!upstream.ok || !payload.success || !payload.data?.sessionToken) {
    return NextResponse.json(
      { success: false, error: payload.error || "Invalid code." },
      { status: upstream.status || 401 }
    );
  }

  const { sessionToken, user } = payload.data;
  const sessionUser = {
    userId: user.userId,
    name: user.name,
    phone: user.email,
    email: user.email,
    role: user.role,
    businessId: user.businessId,
    mfaCompleted: true,
  };

  const response = NextResponse.json({
    success: true,
    data: { user: sessionUser },
  });

  response.cookies.set(
    SESSION_COOKIE,
    JSON.stringify({
      token: sessionToken,
      user: sessionUser,
      authSource: "admin_mfa",
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ONE_WEEK,
    }
  );

  if (
    (user.role === "business_admin" || user.role === "business_viewer") &&
    user.businessId
  ) {
    response.cookies.set(BUSINESS_CONTEXT_COOKIE, user.businessId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ONE_WEEK,
    });
  }

  return response;
}
