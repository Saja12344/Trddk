import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";
import { SESSION_COOKIE } from "@/lib/auth.constants";
import { fetchBackend } from "@/lib/backend.server";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "يجب تسجيل الدخول." },
      { status: 401 }
    );
  }

  const body = await request.json();
  const currentPassword = body.currentPassword as string | undefined;
  const newPassword = body.newPassword as string | undefined;

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { success: false, error: "اكتب كلمة المرور الحالية والجديدة." },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetchBackend("/api/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tardadi-Admin-Token": session.token,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const payload = await upstream.json();
    if (!upstream.ok || !payload.success) {
      return NextResponse.json(
        { success: false, error: payload.error || "تعذّر تغيير كلمة المرور." },
        { status: upstream.status }
      );
    }

    const updatedUser = {
      ...session.user,
      mustChangePassword: false,
    };
    const response = NextResponse.json({ success: true, data: { user: updatedUser } });
    response.cookies.set(
      SESSION_COOKIE,
      JSON.stringify({ token: session.token, user: updatedUser }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      }
    );
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "تعذّر الاتصال بالخادم." },
      { status: 502 }
    );
  }
}
