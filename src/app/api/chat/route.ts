import { NextRequest } from "next/server";

import { proxyPost } from "@/lib/backend";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return proxyPost("/api/chat", req, 60000);
}