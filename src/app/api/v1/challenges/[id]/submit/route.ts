import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { getChallengeById, submitChallenge } from "@/lib/challenges";
import { addVerifiedSkill } from "@/lib/reputation";
import { addCredits } from "@/lib/wallet";
import { appendAudit } from "@/lib/audit";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authorization header required", "UNAUTHORIZED", 401);
  }

  const agent = await verifyApiKey(authHeader.slice(7));
  if (!agent) {
    return errorResponse("Invalid or expired API key", "INVALID_KEY", 401);
  }

  const challenge = await getChallengeById(id);
  if (!challenge) {
    return errorResponse("Challenge not found", "NOT_FOUND", 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", "INVALID_JSON", 400);
  }

  const b = body as Record<string, unknown>;
  if (!b.response || typeof b.response !== "string" || b.response.trim().length === 0) {
    return errorResponse("Field 'response' is required", "MISSING_RESPONSE", 400);
  }

  try {
    const result = await submitChallenge(id, agent.agent_id, b.response as string);

    // If passed: award credits, add verified skill badge
    if (result.passed) {
      await addVerifiedSkill(agent.agent_id, challenge.skill);
      if (result.credits_awarded > 0) {
        await addCredits(agent.agent_id, result.credits_awarded, `Challenge reward: ${id}`);
      }
    }

    // Audit log (non-blocking)
    appendAudit({
      agent_id: agent.agent_id,
      action: result.passed ? "challenge.passed" : "challenge.submitted",
      resource_type: "challenge",
      resource_id: id,
      details: { score: result.score, passed: result.passed, credits_awarded: result.credits_awarded },
    }).catch(() => {});

    return NextResponse.json(result, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return errorResponse(msg, "INTERNAL_ERROR", 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
