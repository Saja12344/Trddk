import { NextRequest, NextResponse } from "next/server";
import { getBusinessContextId, getSession } from "@/lib/auth.server";
import {
  companyBusinessPathAllowed,
  isCompanyScopedRole,
  scopedRequestBusinessId,
} from "@/lib/adminTenantScope";
import {
  getServerApiUrl,
  isAllowedProxyPath,
} from "@/lib/env.server";
import { adaptLegacyCreateBusinessBody } from "@/lib/businessCreateCompat";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[]
): Promise<NextResponse> {
  if (!isAllowedProxyPath(pathSegments)) {
    return NextResponse.json(
      { success: false, error: "ليس لديك صلاحية للوصول لهذا الطلب." },
      { status: 403 }
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "يجب تسجيل الدخول." },
      { status: 401 }
    );
  }

  const scope = scopedRequestBusinessId({
    role: session.user.role,
    tokenBusinessId: session.user.businessId,
    contextBusinessId: await getBusinessContextId(),
  });
  if (
    !scope.ok ||
    !companyBusinessPathAllowed(
      session.user.role,
      session.user.businessId,
      pathSegments
    )
  ) {
    return NextResponse.json(
      { success: false, error: "ليس لديك صلاحية للوصول لهذا الطلب." },
      { status: 403 }
    );
  }

  const apiUrl = getServerApiUrl();
  const businessId = scope.businessId;
  const pathname = pathSegments.join("/");
  const targetUrl = new URL(`${apiUrl}/${pathname}`);

  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== "organizationId" && key !== "businessId") {
      targetUrl.searchParams.set(key, value);
    }
  });

  const isCreateBusiness =
    request.method === "POST" &&
    pathSegments.length === 2 &&
    pathSegments[0] === "api" &&
    pathSegments[1] === "businesses";

  if (businessId && !isCreateBusiness) {
    targetUrl.searchParams.set("businessId", businessId);
    targetUrl.searchParams.set("organizationId", businessId);
  }

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  headers.set("Authorization", `Bearer ${session.token}`);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (MUTATION_METHODS.has(request.method)) {
    let bodyText = await request.text();
    if (bodyText) {
      try {
        const parsed = JSON.parse(bodyText) as Record<string, unknown>;
        if (isCreateBusiness) {
          const adapted = adaptLegacyCreateBusinessBody(parsed);
          if (!adapted.ok) {
            return NextResponse.json(
              { success: false, error: adapted.error },
              { status: 400 }
            );
          }
          Object.assign(parsed, adapted.body);
        }
        if (isCompanyScopedRole(session.user.role)) {
          parsed.businessId = session.user.businessId;
          parsed.organizationId = session.user.businessId;
        } else if (businessId && !isCreateBusiness && parsed.businessId == null) {
          parsed.businessId = businessId;
          parsed.organizationId = businessId;
        }
        bodyText = JSON.stringify(parsed);
      } catch {
        if (isCompanyScopedRole(session.user.role)) {
          return NextResponse.json(
            { success: false, error: "الطلب غير صحيح." },
            { status: 400 }
          );
        }
      }
    }
    init.body = bodyText;
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.toString(), init);
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "تعذّر الاتصال بالخادم. تأكد أن الباكند شغال ثم حدّث الصفحة.",
      },
      { status: 502 }
    );
  }

  const body = await upstream.text();

  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") || "application/json",
    },
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}
