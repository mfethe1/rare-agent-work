import { NextRequest, NextResponse } from "next/server";
import { getReputation } from "@/lib/reputation";
import { CORS_HEADERS_GET } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS_GET });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  if (!agentId || agentId.trim().length === 0) {
    return errorResponse("Agent ID is required", "MISSING_AGENT_ID", 400);
  }

  const reputation = await getReputation(agentId);

  return NextResponse.json(
    {
      agent_id: reputation.agent_id,
      overall_score: reputation.overall_score,
      trust_tier: reputation.trust_tier,
      signals: reputation.signals,
      history: reputation.history.slice(-20),
      last_calculated: reputation.last_calculated,
      member_since: reputation.created_at,
    },
    { headers: CORS_HEADERS_GET },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
