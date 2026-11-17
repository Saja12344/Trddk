import { NextRequest, NextResponse } from "next/server";
import { fetchBackend } from "@/lib/backend.server";

export async function POST(request: NextRequest) {
  const { challengeToken } = (await request.json()) as { challengeToken?: string };
  if (!challengeToken) {
    return NextResponse.json(
      { success: false, error: "Invalid request." },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetchBackend("/api/auth/admin-mfa-resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeToken }),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "تعذّر الاتصال بالخادم." },
      { status: 502 }
    );
  }

  const payload = (await upstream.json()) as {
    success: boolean;
    error?: string;
  };

  if (!upstream.ok || !payload.success) {
    return NextResponse.json(
      { success: false, error: payload.error || "Failed to resend." },
      { status: upstream.status || 400 }
    );
  }

  return NextResponse.json({ success: true, data: { sent: true } });
}
