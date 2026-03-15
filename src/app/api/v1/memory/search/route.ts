/**
 * Agent Memory — search by value content
 * Round 31
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, CORS_HEADERS } from "@/lib/api-headers";
import { verifyApiKey } from "@/lib/agent-auth";
import { searchMemories } from "@/lib/agent-memory";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }
  const agent = await verifyApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400, headers: CORS_HEADERS });
  }

  const namespace = searchParams.get("namespace") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const memories = await searchMemories(agent.agent_id, q, namespace, limit);

  return NextResponse.json(
    { memories, total: memories.length, query: q },
    { headers: getCorsHeaders() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
