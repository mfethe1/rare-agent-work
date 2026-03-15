/**
 * Agent Memory — get/update/delete by key
 * Round 31
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, CORS_HEADERS } from "@/lib/api-headers";
import { verifyApiKey } from "@/lib/agent-auth";
import { getMemory, updateMemory, deleteMemory } from "@/lib/agent-memory";

type Params = { params: Promise<{ key: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }
  const agent = await verifyApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS });
  }

  const { key } = await params;
  const memory = await getMemory(agent.agent_id, decodeURIComponent(key));
  if (!memory) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404, headers: CORS_HEADERS });
  }

  return NextResponse.json({ memory }, { headers: getCorsHeaders() });
}

export async function PUT(req: NextRequest, { params }: Params) {
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
  if (!body || body.value === undefined) {
    return NextResponse.json({ error: "Missing required field: value" }, { status: 400, headers: CORS_HEADERS });
  }

  const { key } = await params;

  try {
    const updated = await updateMemory(
      agent.agent_id,
      decodeURIComponent(key),
      body.value,
      body.ttl_hours,
    );

    if (!updated) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404, headers: CORS_HEADERS });
    }

    return NextResponse.json({ memory: updated }, { headers: getCorsHeaders() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update memory";
    return NextResponse.json({ error: msg }, { status: 400, headers: CORS_HEADERS });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }
  const agent = await verifyApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS });
  }

  const { key } = await params;
  const deleted = await deleteMemory(agent.agent_id, decodeURIComponent(key));

  if (!deleted) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404, headers: CORS_HEADERS });
  }

  return NextResponse.json({ deleted: true }, { headers: getCorsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
