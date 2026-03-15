/**
 * Agent Memory-as-a-Service — list + store
 * Round 31
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, CORS_HEADERS } from "@/lib/api-headers";
import { verifyApiKey } from "@/lib/agent-auth";
import { listMemories, storeMemory } from "@/lib/agent-memory";

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
  const namespace = searchParams.get("namespace") ?? undefined;
  const key_prefix = searchParams.get("key_prefix") ?? undefined;
  const page = parseInt(searchParams.get("page") ?? "1");
  const page_size = parseInt(searchParams.get("page_size") ?? "50");

  const result = await listMemories(agent.agent_id, { namespace, key_prefix, page, page_size });

  return NextResponse.json(result, { headers: getCorsHeaders() });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }
  const agent = await verifyApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS });
  }

  const body = await req.json().catch(() => null);
  if (!body?.key || body.value === undefined) {
    return NextResponse.json(
      { error: "Missing required fields: key, value" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  try {
    const result = await storeMemory(agent.agent_id, {
      key: body.key,
      value: body.value,
      namespace: body.namespace,
      ttl_hours: body.ttl_hours,
    });

    return NextResponse.json(
      { memory: result.memory, created: result.created },
      { status: result.created ? 201 : 200, headers: getCorsHeaders() },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to store memory";
    return NextResponse.json({ error: msg }, { status: 400, headers: CORS_HEADERS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
