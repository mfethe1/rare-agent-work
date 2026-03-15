import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { submitDelivery } from "@/lib/tasks";
import { dispatchWebhookEvent } from "@/lib/webhooks";
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

  if (!b.content || typeof b.content !== "string" || b.content.trim().length === 0) {
    return errorResponse("Field 'content' is required", "MISSING_CONTENT", 400);
  }
  if (b.notes !== undefined && typeof b.notes !== "string") {
    return errorResponse("Field 'notes' must be a string", "INVALID_NOTES", 400);
  }

  try {
    const task = submitDelivery(id, agent.agent_id, {
      content: (b.content as string).trim(),
      notes: typeof b.notes === "string" ? b.notes.trim() : "",
    });

    dispatchWebhookEvent("task.status_changed", {
      task_id: task.id,
      status: task.status,
    }).catch(() => {});

    return NextResponse.json(
      {
        task_id: task.id,
        status: task.status,
        delivery: task.delivery,
        message: "Delivery submitted. Awaiting owner review.",
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    const isClientError = msg.includes("not authorized") || msg.includes("Cannot deliver") || msg.includes("not found");
    return errorResponse(msg, "DELIVER_ERROR", isClientError ? 400 : 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
