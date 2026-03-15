import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { reviewDelivery } from "@/lib/tasks";
import { releaseEscrow } from "@/lib/wallet";
import { recordTaskCompleted, recordTaskFailed } from "@/lib/reputation";
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

  if (typeof b.rating !== "number" || b.rating < 1 || b.rating > 5 || !Number.isInteger(b.rating)) {
    return errorResponse("Field 'rating' must be an integer from 1 to 5", "INVALID_RATING", 400);
  }
  if (!b.feedback || typeof b.feedback !== "string" || b.feedback.trim().length === 0) {
    return errorResponse("Field 'feedback' is required", "MISSING_FEEDBACK", 400);
  }
  if (typeof b.accept !== "boolean") {
    return errorResponse("Field 'accept' must be a boolean", "INVALID_ACCEPT", 400);
  }

  try {
    const task = reviewDelivery(id, agent.agent_id, {
      rating: b.rating as number,
      feedback: (b.feedback as string).trim(),
      accept: b.accept as boolean,
    });

    // If accepted: release escrowed credits to the specialist
    if (b.accept && task.assigned_agent_id) {
      try {
        releaseEscrow(
          task.assigned_agent_id,
          agent.agent_id,
          task.budget.credits,
          task.id,
        );
      } catch (escrowErr) {
        console.error("[review] Escrow release failed:", escrowErr);
        // Non-fatal — task is still marked complete
      }

      // Update reputation for specialist
      recordTaskCompleted(task.assigned_agent_id, task.id, b.rating as number);
    } else if (!b.accept && task.assigned_agent_id) {
      // Mark as failed if explicitly rejected after review
      recordTaskFailed(task.assigned_agent_id, task.id);
    }

    dispatchWebhookEvent("task.status_changed", {
      task_id: task.id,
      status: task.status,
    }).catch(() => {});

    return NextResponse.json(
      {
        task_id: task.id,
        status: task.status,
        review: task.review,
        escrow_released: b.accept === true,
        message: b.accept
          ? "Delivery accepted. Credits released to specialist."
          : "Delivery sent back for revision. Credits remain in escrow.",
      },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    const isClientError = msg.includes("Not authorized") || msg.includes("Cannot review") || msg.includes("not found");
    return errorResponse(msg, "REVIEW_ERROR", isClientError ? 400 : 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
