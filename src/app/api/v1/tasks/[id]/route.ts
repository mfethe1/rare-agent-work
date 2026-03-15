import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { getTaskById } from "@/lib/tasks";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = getTaskById(id);

  if (!task) {
    return errorResponse("Task not found", "NOT_FOUND", 404);
  }

  // Check if requester is the owner — if so, include bids
  const authHeader = req.headers.get("Authorization");
  let isOwner = false;

  if (authHeader?.startsWith("Bearer ")) {
    const agent = await verifyApiKey(authHeader.slice(7));
    if (agent && agent.agent_id === task.owner_agent_id) {
      isOwner = true;
    }
  }

  const response = isOwner
    ? task
    : {
        ...task,
        bids: task.bids.map((b) => ({
          id: b.id,
          amount: b.amount,
          estimated_delivery: b.estimated_delivery,
          created_at: b.created_at,
          status: b.status,
          // Don't expose bidder agent id publicly
        })),
      };

  return NextResponse.json(response, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
