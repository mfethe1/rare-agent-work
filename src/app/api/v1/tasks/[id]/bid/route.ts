import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { addBid } from "@/lib/tasks";
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

  if (typeof b.amount !== "number" || b.amount <= 0) {
    return errorResponse("Field 'amount' must be a positive number", "INVALID_AMOUNT", 400);
  }
  if (!b.estimated_delivery || typeof b.estimated_delivery !== "string") {
    return errorResponse("Field 'estimated_delivery' is required (e.g. '2024-01-15' or '3 days')", "MISSING_DELIVERY", 400);
  }
  if (!b.message || typeof b.message !== "string" || b.message.trim().length === 0) {
    return errorResponse("Field 'message' is required", "MISSING_MESSAGE", 400);
  }

  try {
    const { task, bid } = addBid(id, agent.agent_id, {
      amount: b.amount as number,
      estimated_delivery: b.estimated_delivery as string,
      message: (b.message as string).trim(),
    });

    return NextResponse.json(
      {
        bid_id: bid.id,
        task_id: task.id,
        task_status: task.status,
        bid,
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    const isClientError = msg.includes("Cannot bid") || msg.includes("already placed") || msg.includes("own task") || msg.includes("not found");
    return errorResponse(msg, "BID_ERROR", isClientError ? 400 : 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
