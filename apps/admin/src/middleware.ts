import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth.constants";
import { sessionFromAdminCookie } from "@/lib/adminSessionToken";

const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/en",
  "/privacy",
  "/terms",
];

const PUBLIC_FILES = new Set([
  "/manifest.json",
  "/apple-touch-icon-orange-only.png",
  "/robots.txt",
  "/sitemap.xml",
]);


function isFirebaseAction(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const mode = request.nextUrl.searchParams.get("mode");
  const oobCode = request.nextUrl.searchParams.get("oobCode");
  return (
    pathname === "/__/auth/action" ||
    pathname.startsWith("/__/auth/") ||
    Boolean(oobCode) ||
    mode === "resetPassword" ||
    mode === "verifyEmail" ||
    mode === "recoverEmail"
  );
}

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  if (PUBLIC_FILES.has(pathname)) return true;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/marketing")
  ) {
    return true;
  }
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://apis.google.com https://www.gstatic.com https://www.google.com https://www.recaptcha.net"
      : "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com https://apis.google.com https://www.gstatic.com https://www.google.com https://www.recaptcha.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://maps.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com https://maps.gstatic.com data:",
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://tiles.openfreemap.org https://*.openfreemap.org https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com",
    "connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://apis.google.com https://*.firebaseapp.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://tiles.openfreemap.org https://*.openfreemap.org",
    "frame-src 'self' https://*.firebaseapp.com https://*.google.com https://accounts.google.com https://apis.google.com https://www.recaptcha.net",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = pathname === "/en" || pathname.startsWith("/en/") ? "en" : "ar";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-trddk-locale", locale);

  const isPublic = isPublicPath(pathname);
  const sessionRaw = request.cookies.get(SESSION_COOKIE)?.value;
  const verified = Boolean(
    await sessionFromAdminCookie(
      sessionRaw,
      process.env.ADMIN_JWT_SECRET
    )
  );
  const firebaseAction = isFirebaseAction(request);

  if (firebaseAction && pathname !== "/reset-password") {
    const actionUrl = new URL("/reset-password", request.url);
    actionUrl.search = request.nextUrl.search;
    return applySecurityHeaders(NextResponse.redirect(actionUrl));
  }

  if (!isPublic && !pathname.startsWith("/api/auth/")) {
    if (!verified) {
      const loginUrl = new URL("/login", request.url);
      if (pathname !== "/login") {
        loginUrl.searchParams.set("next", pathname);
      }
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }
  }

  if (pathname === "/login" && verified) {
    return applySecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  return applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } })
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
