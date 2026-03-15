import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { createWorkflow, getAgentWorkflows, type StepType } from "@/lib/workflows";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

const VALID_STEP_TYPES: StepType[] = ["api_call", "agent_task", "conditional", "parallel", "wait"];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authorization header required", "UNAUTHORIZED", 401);
  }

  const agent = await verifyApiKey(authHeader.slice(7));
  if (!agent) {
    return errorResponse("Invalid or expired API key", "INVALID_KEY", 401);
  }

  const workflows = await getAgentWorkflows(agent.agent_id);

  return NextResponse.json(
    {
      workflows: workflows.map((w) => ({
        id: w.id,
        name: w.name,
        status: w.status,
        steps_count: w.steps.length,
        created_at: w.created_at,
        started_at: w.started_at,
        completed_at: w.completed_at,
      })),
      total: workflows.length,
    },
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

  if (!b.name || typeof b.name !== "string" || b.name.trim().length === 0) {
    return errorResponse("Field 'name' is required", "MISSING_NAME", 400);
  }
  if (!Array.isArray(b.steps) || b.steps.length === 0) {
    return errorResponse("Field 'steps' must be a non-empty array", "MISSING_STEPS", 400);
  }

  for (let i = 0; i < b.steps.length; i++) {
    const step = b.steps[i];
    if (!step || typeof step !== "object") {
      return errorResponse(`steps[${i}] must be an object`, "INVALID_STEP", 400);
    }
    const s = step as Record<string, unknown>;
    if (!s.type || !VALID_STEP_TYPES.includes(s.type as StepType)) {
      return errorResponse(
        `steps[${i}].type must be one of: ${VALID_STEP_TYPES.join(", ")}`,
        "INVALID_STEP_TYPE",
        400,
      );
    }
    if (!s.config || typeof s.config !== "object" || Array.isArray(s.config)) {
      return errorResponse(`steps[${i}].config must be an object`, "INVALID_STEP_CONFIG", 400);
    }
  }

  const workflow = await createWorkflow({
    name: b.name as string,
    created_by: agent.agent_id,
    steps: (b.steps as Array<{ type: StepType; config: Record<string, unknown> }>),
  });

  return NextResponse.json(workflow, { status: 201, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
