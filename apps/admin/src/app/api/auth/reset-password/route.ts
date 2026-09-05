import { NextRequest, NextResponse } from "next/server";
import { fetchBackend } from "@/lib/backend.server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const token = (body.token as string | undefined)?.trim();
  const password = body.password as string | undefined;

  if (!token || !password) {
    return NextResponse.json(
      { success: false, error: "البيانات غير مكتملة." },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetchBackend("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
      cache: "no-store",
    });
    const payload = await upstream.json();
    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: payload.error || "تعذّر تغيير كلمة المرور." },
        { status: upstream.status }
      );
    }
    return NextResponse.json({ success: true, data: payload.data });
  } catch {
    return NextResponse.json(
      { success: false, error: "تعذّر الاتصال بالخادم." },
      { status: 502 }
    );
  }
}
