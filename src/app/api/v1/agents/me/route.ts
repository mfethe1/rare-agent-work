import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { verifyApiKey } from "@/lib/agent-auth";
import { getReputation } from "@/lib/reputation";
import { getBalance } from "@/lib/wallet";
import { CORS_HEADERS } from "@/lib/api-headers";
import type { AgentRecord } from "@/lib/agent-auth";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

const AGENTS_FILE = path.join(process.cwd(), "data/agents/agents.json");

function readAgents(): AgentRecord[] {
  try {
    const raw = fs.readFileSync(AGENTS_FILE, "utf-8");
    return JSON.parse(raw) as AgentRecord[];
  } catch {
    return [];
  }
}

function writeAgents(agents: AgentRecord[]): void {
  const dir = path.dirname(AGENTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2), "utf-8");
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authorization header required", "UNAUTHORIZED", 401);
  }

  const agent = await verifyApiKey(authHeader.slice(7));
  if (!agent) {
    return errorResponse("Invalid or expired API key", "INVALID_KEY", 401);
  }

  const reputation = getReputation(agent.agent_id);
  const { balance, escrowed } = getBalance(agent.agent_id);

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

  // Validate optional fields
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
      if (!["https:", "http:"].includes(u.protocol)) {
        throw new Error("bad protocol");
      }
    } catch {
      return errorResponse("'callback_url' must be a valid URL", "INVALID_CALLBACK_URL", 400);
    }
  }

  const agents = readAgents();
  const idx = agents.findIndex((a) => a.agent_id === agent.agent_id);
  if (idx === -1) {
    return errorResponse("Agent not found", "NOT_FOUND", 404);
  }

  if (b.description !== undefined) {
    agents[idx].description = (b.description as string).trim();
  }
  if (b.capabilities !== undefined) {
    agents[idx].capabilities = b.capabilities as string[];
  }
  if (b.callback_url !== undefined) {
    agents[idx].callback_url = b.callback_url === null ? undefined : (b.callback_url as string);
  }

  writeAgents(agents);

  return NextResponse.json(
    {
      id: agents[idx].agent_id,
      name: agents[idx].name,
      description: agents[idx].description,
      capabilities: agents[idx].capabilities,
      callback_url: agents[idx].callback_url,
      updated: true,
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
