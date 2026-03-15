import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { proposeContract, getAgentContracts } from "@/lib/contracts";
import { CORS_HEADERS } from "@/lib/api-headers";
import { appendAudit } from "@/lib/audit";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
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

  const contracts = await getAgentContracts(agent.agent_id);

  return NextResponse.json(
    { contracts, total: contracts.length },
    { headers: CORS_HEADERS },
  );
}

export async function POST(req: NextRequest) {
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

  if (!b.counterparty_id || typeof b.counterparty_id !== "string") {
    return errorResponse("Field 'counterparty_id' is required", "MISSING_COUNTERPARTY", 400);
  }
  if (b.counterparty_id === agent.agent_id) {
    return errorResponse("Cannot propose a contract with yourself", "INVALID_COUNTERPARTY", 400);
  }
  if (!b.terms || typeof b.terms !== "object" || Array.isArray(b.terms)) {
    return errorResponse("Field 'terms' is required", "MISSING_TERMS", 400);
  }

  const terms = b.terms as Record<string, unknown>;

  if (!terms.delivery_deadline || typeof terms.delivery_deadline !== "string") {
    return errorResponse("terms.delivery_deadline is required (ISO date string)", "MISSING_DEADLINE", 400);
  }
  if (typeof terms.quality_threshold !== "number" || terms.quality_threshold < 1 || terms.quality_threshold > 5) {
    return errorResponse("terms.quality_threshold must be a number between 1 and 5", "INVALID_THRESHOLD", 400);
  }
  if (typeof terms.retry_limit !== "number" || terms.retry_limit < 0) {
    return errorResponse("terms.retry_limit must be a non-negative number", "INVALID_RETRY_LIMIT", 400);
  }
  if (typeof terms.escrow_amount !== "number" || terms.escrow_amount <= 0) {
    return errorResponse("terms.escrow_amount must be a positive number", "INVALID_ESCROW", 400);
  }
  if (!terms.sla || typeof terms.sla !== "object") {
    return errorResponse("terms.sla is required", "MISSING_SLA", 400);
  }
  const sla = terms.sla as Record<string, unknown>;
  if (typeof sla.max_response_time_hours !== "number" || sla.max_response_time_hours <= 0) {
    return errorResponse("terms.sla.max_response_time_hours must be a positive number", "INVALID_SLA", 400);
  }

  const rawContract = await proposeContract({
    proposer_id: agent.agent_id,
    counterparty_id: b.counterparty_id as string,
    task_id: typeof b.task_id === "string" ? b.task_id : undefined,
    terms: {
      delivery_deadline: terms.delivery_deadline as string,
      quality_threshold: terms.quality_threshold as number,
      retry_limit: terms.retry_limit as number,
      escrow_amount: terms.escrow_amount as number,
      penalty_on_breach: typeof terms.penalty_on_breach === "number" ? terms.penalty_on_breach : undefined,
      sla: {
        max_response_time_hours: sla.max_response_time_hours as number,
        availability_percent: typeof sla.availability_percent === "number" ? sla.availability_percent : undefined,
      },
    },
  });

  const contract = rawContract;

  appendAudit({
    agent_id: agent.agent_id,
    action: "contract.proposed",
    resource_type: "contract",
    resource_id: contract.id,
    details: { counterparty_id: b.counterparty_id as string },
  }).catch(() => {});

  return NextResponse.json(contract, { status: 201, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
