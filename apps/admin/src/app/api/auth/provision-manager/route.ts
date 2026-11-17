import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";
import { isSuperAdmin } from "@/lib/auth.constants";
import { provisionCompanyManagerLogin } from "@/lib/provisionManager.server";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session.user)) {
    return NextResponse.json(
      { success: false, error: "هذا الإجراء متاح لمدير النظام فقط." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as {
    businessId?: string;
    email?: string;
    displayName?: string;
  };
  if (!body.businessId || !body.email?.trim() || !body.displayName?.trim()) {
    return NextResponse.json(
      { success: false, error: "الاسم والبريد ومعرّف الشركة مطلوبة." },
      { status: 400 }
    );
  }

  const result = await provisionCompanyManagerLogin({
    token: session.token,
    businessId: body.businessId,
    email: body.email,
    displayName: body.displayName,
  });

  if (!result.invited) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    data: result,
    error: result.error,
  });
}
