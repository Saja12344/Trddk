import { NextRequest, NextResponse } from "next/server";
import { fetchBackend } from "@/lib/backend.server";
import { lookupFirebaseIdToken } from "@/lib/firebaseIdentity.server";
import { linkManagerEmailToBusinesses } from "@/lib/firestoreAdmin.server";

export async function POST(request: NextRequest) {
  const { idToken } = (await request.json()) as { idToken?: string };
  if (!idToken) {
    return NextResponse.json(
      { success: false, error: "Invalid credentials." },
      { status: 400 }
    );
  }

  try {
    const identity = await lookupFirebaseIdToken(idToken);
    if (identity?.uid && identity.email) {
      await linkManagerEmailToBusinesses({
        uid: identity.uid,
        email: identity.email,
      });
    }
  } catch {
    // Continue to MFA; linking is best-effort so the code can still send.
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

  const payload = (await upstream.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { challengeToken: string; email: string };
    error?: string;
  };

  if (upstream.ok && payload.success && payload.data?.challengeToken) {
    return NextResponse.json({ success: true, data: payload.data });
  }

  const raw = payload.error || "Invalid credentials.";
  const error = /admin account not provisioned/i.test(raw)
    ? "الحساب غير مربوط بشركة في لوحة الإدارة. اطلب من مدير النظام حفظ البريد وإرسال الدعوة مرة واحدة من صفحة الشركة."
    : /invalid credentials/i.test(raw)
      ? "تم التحقق من البريد، لكن الحساب غير مكتمل. اطلب من مدير النظام إرسال دعوة مدير الشركة ثم عيّن كلمة المرور من الإيميل."
      : raw;
  return NextResponse.json(
    { success: false, error },
    { status: upstream.status || 401 }
  );
}
