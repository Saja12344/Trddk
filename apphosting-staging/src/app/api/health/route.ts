import { NextResponse } from "next/server";
import { fetchBackend } from "@/lib/backend.server";
import { getServerApiUrl } from "@/lib/env.server";

export async function GET() {
  const apiUrl = getServerApiUrl();
  const started = Date.now();

  try {
    const upstream = await fetchBackend("/api/health", {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const body = await upstream.json().catch(() => null);
    const latencyMs = Date.now() - started;

    if (!upstream.ok) {
      console.error("[health] upstream failed", {
        status: upstream.status,
        apiUrl,
        latencyMs,
      });
      return NextResponse.json(
        {
          success: false,
          error: "الخادم لا يستجيب بشكل صحيح.",
          data: { apiUrl, latencyMs, upstreamStatus: upstream.status },
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        admin: "ok",
        apiUrl,
        latencyMs,
        upstream: body,
      },
    });
  } catch (error) {
    const latencyMs = Date.now() - started;
    console.error("[health] connection error", {
      apiUrl,
      latencyMs,
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        success: false,
        error: "تعذّر الاتصال بالخادم. تحقق من Cloud Functions والشبكة.",
        data: { apiUrl, latencyMs },
      },
      { status: 502 }
    );
  }
}
