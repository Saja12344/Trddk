import { NextResponse } from "next/server";

/** Legacy route disabled — password reset is client-side Firebase Auth only. */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "تم إيقاف هذا المسار. استخدم صفحة «نسيت كلمة المرور» بالبريد الإلكتروني — التحديث يتم عبر Firebase مباشرة من المتصفح.",
    },
    { status: 410 }
  );
}
