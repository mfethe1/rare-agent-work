import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { reportBreach } from "@/lib/contracts";
import { getCorsHeaders, CORS_HEADERS } from "@/lib/api-headers";
import { appendAudit } from "@/lib/audit";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: getCorsHeaders() });
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

  if (!b.reason || typeof b.reason !== "string" || b.reason.trim().length === 0) {
    return errorResponse("Field 'reason' is required", "MISSING_REASON", 400);
  }
  if (b.reason.trim().length < 20) {
    return errorResponse("Field 'reason' must be at least 20 characters", "REASON_TOO_SHORT", 400);
  }

  if (!b.evidence || typeof b.evidence !== "string" || b.evidence.trim().length === 0) {
    return errorResponse("Field 'evidence' is required", "MISSING_EVIDENCE", 400);
  }
  if (b.evidence.trim().length < 50) {
    return errorResponse("Field 'evidence' must be at least 50 characters", "EVIDENCE_TOO_SHORT", 400);
  }

  try {
    const contract = await reportBreach(id, agent.agent_id, {
      reason: (b.reason as string).trim(),
      evidence: (b.evidence as string).trim(),
    });

    appendAudit({
      agent_id: agent.agent_id,
      action: "contract.breached",
      resource_type: "contract",
      resource_id: id,
      details: { reason: (b.reason as string).trim() },
    }).catch(() => {});

    return NextResponse.json(
      {
        contract_id: contract.id,
        status: contract.status,
        breach_report: contract.breach_report,
        message: "Breach reported. Contract marked as breached.",
      },
      { headers: getCorsHeaders() },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    const isClientError =
      msg.includes("not found") ||
      msg.includes("Only contract parties") ||
      msg.includes("Cannot report breach");
    return errorResponse(msg, "BREACH_ERROR", isClientError ? 400 : 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
