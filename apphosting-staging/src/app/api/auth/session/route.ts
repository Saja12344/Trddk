import { NextResponse } from "next/server";
import { getBusinessContextId, getSession } from "@/lib/auth.server";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "غير مسجّل" }, { status: 401 });
  }
  const activeBusinessId = await getBusinessContextId();
  return NextResponse.json({
    success: true,
    data: session.user,
    activeBusinessId,
  });
}
