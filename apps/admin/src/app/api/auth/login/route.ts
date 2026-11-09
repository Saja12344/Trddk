import { NextRequest, NextResponse } from "next/server";
import {
  BUSINESS_CONTEXT_COOKIE,
  SESSION_COOKIE,
} from "@/lib/auth.constants";
import { getAdminJwtSecret } from "@/lib/auth.server";
import { verifyAdminSessionToken } from "@/lib/adminSessionToken";
import { getServerApiUrl } from "@/lib/env.server";

const ONE_WEEK = 60 * 60 * 24 * 7;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { phone, password } = body as { phone?: string; password?: string };

  if (!phone || !password) {
    return NextResponse.json(
      { success: false, error: "اكتب رقم الجوال وكلمة المرور." },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${getServerApiUrl()}/api/auth/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "تعذّر الاتصال بالخادم. تأكد أن الباكند شغال.",
      },
      { status: 502 }
    );
  }

  const payload = (await upstream.json()) as {
    success: boolean;
    data?: { token: string; user?: unknown };
    error?: string;
  };

  if (!upstream.ok || !payload.success || !payload.data?.token) {
    return NextResponse.json(
      {
        success: false,
        error: payload.error || "رقم الجوال أو كلمة المرور غير صحيحة.",
      },
      { status: upstream.status || 401 }
    );
  }

  const claims = await verifyAdminSessionToken(
    payload.data.token,
    getAdminJwtSecret()
  );
  if (!claims) {
    return NextResponse.json(
      { success: false, error: "رقم الجوال أو كلمة المرور غير صحيحة." },
      { status: 401 }
    );
  }

  const user = {
    userId: claims.sub,
    name: claims.name,
    phone: claims.phone,
    role: claims.role,
    businessId: claims.businessId,
  };

  const response = NextResponse.json({
    success: true,
    data: { user },
  });

  response.cookies.set(
    SESSION_COOKIE,
    JSON.stringify({ token: payload.data.token, user }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ONE_WEEK,
    }
  );

  if (user.role === "business_admin" && user.businessId) {
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
