import { NextRequest, NextResponse } from "next/server";

import { backendUrl, proxyPost } from "@/lib/backend";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return proxyPost("/api/recommend", req, 30000);
}

export async function GET() {
  try {
    const res = await fetch(backendUrl() + "/api/health", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json(
      { mongo: false, chroma: false, llm_configured: false, degraded: true },
      { status: 200 }
    );
  }
}