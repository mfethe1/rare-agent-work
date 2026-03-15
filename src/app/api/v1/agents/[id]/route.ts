import { NextRequest, NextResponse } from "next/server";
import { getAllAgents } from "@/lib/agent-auth";
import { getReputation } from "@/lib/reputation";
import { CORS_HEADERS_GET } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS_GET });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const agents = await getAllAgents();
  const agent = agents.find((a) => a.agent_id === id);

  if (!agent) {
    return errorResponse("Agent not found", "NOT_FOUND", 404);
  }

  const reputation = await getReputation(agent.agent_id);

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
