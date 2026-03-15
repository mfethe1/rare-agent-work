import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { deleteWebhook, getWebhookById } from "@/lib/webhooks";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

export async function DELETE(
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

  const webhook = getWebhookById(id);
  if (!webhook) {
    return errorResponse("Webhook not found", "NOT_FOUND", 404);
  }
  if (webhook.agent_id !== agent.agent_id) {
    return errorResponse("Not authorized to delete this webhook", "FORBIDDEN", 403);
  }

  const deleted = deleteWebhook(id, agent.agent_id);
  if (!deleted) {
    return errorResponse("Webhook not found or already deleted", "NOT_FOUND", 404);
  }

  return NextResponse.json(
    { deleted: true, id },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
