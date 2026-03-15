import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { registerWebhook, getAgentWebhooks, VALID_WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/webhooks";
import { CORS_HEADERS } from "@/lib/api-headers";

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

  const webhooks = getAgentWebhooks(agent.agent_id);

  // Don't expose secrets in list
  const safeWebhooks = webhooks.map((w) => ({
    id: w.id,
    url: w.url,
    events: w.events,
    active: w.active,
    delivery_count: w.delivery_count,
    last_delivery: w.last_delivery,
    created_at: w.created_at,
  }));

  return NextResponse.json(
    { webhooks: safeWebhooks, total: safeWebhooks.length },
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

  if (!b.url || typeof b.url !== "string") {
    return errorResponse("Field 'url' is required", "MISSING_URL", 400);
  }
  if (!Array.isArray(b.events) || b.events.length === 0) {
    return errorResponse(
      `Field 'events' must be a non-empty array. Valid events: ${VALID_WEBHOOK_EVENTS.join(", ")}`,
      "MISSING_EVENTS",
      400,
    );
  }
  if (b.secret !== undefined && typeof b.secret !== "string") {
    return errorResponse("Field 'secret' must be a string", "INVALID_SECRET", 400);
  }

  try {
    const webhook = registerWebhook({
      agent_id: agent.agent_id,
      url: b.url as string,
      events: b.events as WebhookEvent[],
      secret: b.secret as string | undefined,
    });

    return NextResponse.json(
      {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        secret: webhook.secret, // Return secret ONCE at creation
        active: webhook.active,
        created_at: webhook.created_at,
        note: "Save the 'secret' — it will not be shown again. Use it to verify HMAC-SHA256 signatures on delivered events.",
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    const isClientError = msg.includes("Invalid") || msg.includes("Maximum") || msg.includes("At least");
    return errorResponse(msg, "WEBHOOK_ERROR", isClientError ? 400 : 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
