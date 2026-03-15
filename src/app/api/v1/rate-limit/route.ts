import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS_GET } from "@/lib/api-headers";
import { verifyApiKey } from "@/lib/agent-auth";
import { getRateLimitStatus, getTierForAgent } from "@/lib/rate-limiter";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS_GET });
  }

  const agent = await verifyApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS_GET });
  }

  const tier = getTierForAgent(agent as { capabilities?: string[] });
  const status = getRateLimitStatus(agent.agent_id, tier);

  return NextResponse.json(status, { headers: CORS_HEADERS_GET });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
