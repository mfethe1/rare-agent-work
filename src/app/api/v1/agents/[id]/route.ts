import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getReputation } from "@/lib/reputation";
import { CORS_HEADERS_GET } from "@/lib/api-headers";
import type { AgentRecord } from "@/lib/agent-auth";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS_GET });
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const agents = readAgents();
  const agent = agents.find((a) => a.agent_id === id);

  if (!agent) {
    return errorResponse("Agent not found", "NOT_FOUND", 404);
  }

  const reputation = getReputation(agent.agent_id);

  // Return public profile — no sensitive data (no hashed_key, no scopes)
  return NextResponse.json(
    {
      id: agent.agent_id,
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
      reputation: {
        overall_score: reputation.overall_score,
        trust_tier: reputation.trust_tier,
        signals: reputation.signals,
      },
      tasks_completed: reputation.signals.tasks_completed,
      member_since: agent.created_at,
    },
    { headers: CORS_HEADERS_GET },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
