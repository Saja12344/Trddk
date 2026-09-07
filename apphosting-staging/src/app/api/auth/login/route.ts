import { NextRequest, NextResponse } from "next/server";
import type { AdminLoginResponse } from "@tardadi/shared";
import {
  BUSINESS_CONTEXT_COOKIE,
  SESSION_COOKIE,
} from "@/lib/auth.constants";
import { fetchBackend } from "@/lib/backend.server";

const ONE_WEEK = 60 * 60 * 24 * 7;

type LoginBody =
  | { idToken: string }
  | { phone: string; password: string }
  | { email: string; password: string; idToken: string };

export async function POST(request: NextRequest) {
  const body = (await request.json()) as LoginBody;

  if ("idToken" in body && body.idToken) {
    let upstream: Response;
    try {
      upstream = await fetchBackend("/api/auth/firebase-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: body.idToken }),
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
      data?: {
        idToken: string;
        user: AdminLoginResponse["user"] & { email?: string };
      };
      error?: string;
    };

    if (!upstream.ok || !payload.success || !payload.data?.idToken) {
      return NextResponse.json(
        {
          success: false,
          error: payload.error || "فشل تسجيل الدخول.",
        },
        { status: upstream.status || 401 }
      );
    }

    const { idToken, user } = payload.data;
    const sessionUser = {
      ...user,
      phone: user.email ?? user.phone,
    };

    const response = NextResponse.json({
      success: true,
      data: { user: sessionUser },
    });

    response.cookies.set(
      SESSION_COOKIE,
      JSON.stringify({ token: idToken, user: sessionUser, authSource: "firebase" }),
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

  const phone = "phone" in body ? body.phone : undefined;
  const password = "password" in body ? body.password : undefined;

  if (!phone || !password) {
    return NextResponse.json(
      { success: false, error: "اكتب البريد وكلمة المرور." },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetchBackend("/api/auth/admin-login", {
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
    data?: { token: string; user: AdminLoginResponse["user"] };
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

  const { token, user } = payload.data;

  const response = NextResponse.json({
    success: true,
    data: { user },
  });

  response.cookies.set(
    SESSION_COOKIE,
    JSON.stringify({ token, user, authSource: "legacy_jwt" }),
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
