import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Private backend URL used by BFF proxies (never bundled to client). */
export function backendUrl(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8000"
  );
}

export async function proxyPost(
  path: string,
  req: NextRequest,
  timeoutMs = 30000
): Promise<NextResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = await req.json().catch(() => ({}));
    const res = await fetch(backendUrl() + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const e = err as Error;
    const timedOut = e.name === "AbortError";
    return NextResponse.json(
      {
        error: timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
        message: timedOut ? "The assistant took too long to reply." : "The assistant service is unreachable.",
        detail: `Backend (${path}) via ${backendUrl()}`,
      },
      { status: timedOut ? 504 : 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}