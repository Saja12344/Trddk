import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { success: false, error: "تعذّر تسجيل الدخول." },
    { status: 401 }
  );
}
