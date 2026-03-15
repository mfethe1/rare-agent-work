import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { runWorkflow } from "@/lib/workflows";
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

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text);
    }
  } catch {
    return errorResponse("Invalid JSON body", "INVALID_JSON", 400);
  }

  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const input = b.input && typeof b.input === "object" && !Array.isArray(b.input)
    ? (b.input as Record<string, unknown>)
    : undefined;

  try {
    const workflow = await runWorkflow(id, agent.agent_id, input);

    return NextResponse.json(
      {
        workflow_id: workflow.id,
        status: workflow.status,
        steps: workflow.steps,
        started_at: workflow.started_at,
        completed_at: workflow.completed_at,
        message: workflow.status === "completed"
          ? "Workflow completed successfully."
          : "Workflow failed during execution. Check step errors.",
      },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    const isClientError =
      msg.includes("not found") ||
      msg.includes("Not authorized") ||
      msg.includes("already running");
    return errorResponse(msg, "RUN_ERROR", isClientError ? 400 : 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
