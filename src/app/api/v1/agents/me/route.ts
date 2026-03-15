import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey, getAllAgents } from "@/lib/agent-auth";
import { JsonFileStore } from "@/lib/data-store";
import { getReputation } from "@/lib/reputation";
import { getBalance } from "@/lib/wallet";
import { CORS_HEADERS } from "@/lib/api-headers";
import type { AgentRecord } from "@/lib/agent-auth";
import path from "node:path";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

const AGENTS_FILE = path.join(process.cwd(), "data/agents/agents.json");
const agentStore = new JsonFileStore<AgentRecord>(AGENTS_FILE);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authorization header required", "UNAUTHORIZED", 401);
  }

  const agent = await verifyApiKey(authHeader.slice(7));
  if (!agent) {
    return errorResponse("Invalid or expired API key", "INVALID_KEY", 401);
  }

  const reputation = await getReputation(agent.agent_id);
  const { balance, escrowed } = await getBalance(agent.agent_id);

  return NextResponse.json(
    {
      id: agent.agent_id,
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
      callback_url: agent.callback_url,
      scopes: agent.scopes,
      reputation: {
        overall_score: reputation.overall_score,
        trust_tier: reputation.trust_tier,
        signals: reputation.signals,
      },
      wallet: { balance, escrowed, currency: "credits" },
      member_since: agent.created_at,
    },
    { headers: CORS_HEADERS },
  );
}

export async function PUT(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authorization header required", "UNAUTHORIZED", 401);
  }

  const agent = await verifyApiKey(authHeader.slice(7));
  if (!agent) {
    return errorResponse("Invalid or expired API key", "INVALID_KEY", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", "INVALID_JSON", 400);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("Request body must be a JSON object", "INVALID_BODY", 400);
  }

  const b = body as Record<string, unknown>;

  if (b.description !== undefined && (typeof b.description !== "string" || b.description.trim().length === 0)) {
    return errorResponse("'description' must be a non-empty string", "INVALID_DESCRIPTION", 400);
  }
  if (b.capabilities !== undefined) {
    if (!Array.isArray(b.capabilities) || !b.capabilities.every((c) => typeof c === "string")) {
      return errorResponse("'capabilities' must be an array of strings", "INVALID_CAPABILITIES", 400);
    }
  }
  if (b.callback_url !== undefined && b.callback_url !== null) {
    if (typeof b.callback_url !== "string") {
      return errorResponse("'callback_url' must be a string or null", "INVALID_CALLBACK_URL", 400);
    }
    try {
      const u = new URL(b.callback_url as string);
      if (!["https:", "http:"].includes(u.protocol)) throw new Error("bad protocol");
    } catch {
      return errorResponse("'callback_url' must be a valid URL", "INVALID_CALLBACK_URL", 400);
    }
  }

  const partial: Partial<AgentRecord> = {};
  if (b.description !== undefined) partial.description = (b.description as string).trim();
  if (b.capabilities !== undefined) partial.capabilities = b.capabilities as string[];
  if (b.callback_url !== undefined) {
    partial.callback_url = b.callback_url === null ? undefined : (b.callback_url as string);
  }

  const updated = await agentStore.update(agent.id, partial);
  if (!updated) {
    return errorResponse("Agent not found", "NOT_FOUND", 404);
  }

  return NextResponse.json(
    {
      id: updated.agent_id,
      name: updated.name,
      description: updated.description,
      capabilities: updated.capabilities,
      callback_url: updated.callback_url,
      updated: true,
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
