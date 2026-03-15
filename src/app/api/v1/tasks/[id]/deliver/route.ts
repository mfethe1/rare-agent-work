import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { submitDelivery } from "@/lib/tasks";
import { dispatchWebhookEvent } from "@/lib/webhooks";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

// Fix 4: Basic injection pattern detection
const INJECTION_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i,        // onclick=, onload=, etc.
  /\{\{.*\}\}/,        // template injection
  /\$\{.*\}/,          // JS template literals
  /__proto__/,
  /constructor\s*\[/,
  /eval\s*\(/i,
  /document\.cookie/i,
  /window\.location/i,
];

const MAX_CONTENT_BYTES = 100 * 1024; // 100KB

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

  // Fix 4: Validate content is a string (no objects/arrays)
  if (b.content === null || b.content === undefined) {
    return errorResponse("Field 'content' is required", "MISSING_CONTENT", 400);
  }
  if (typeof b.content !== "string") {
    return errorResponse(
      "Field 'content' must be a string, not an object or array",
      "INVALID_CONTENT_TYPE",
      400,
    );
  }
  if (b.content.trim().length === 0) {
    return errorResponse("Field 'content' must not be empty", "MISSING_CONTENT", 400);
  }

  // Fix 4: Max content size: 100KB
  const contentBytes = Buffer.byteLength(b.content, "utf-8");
  if (contentBytes > MAX_CONTENT_BYTES) {
    return errorResponse(
      `Content exceeds maximum size of 100KB (received ${Math.round(contentBytes / 1024)}KB)`,
      "CONTENT_TOO_LARGE",
      413,
    );
  }

  // Fix 4: Basic injection pattern detection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(b.content)) {
      return errorResponse(
        "Content contains disallowed patterns",
        "CONTENT_REJECTED",
        400,
      );
    }
  }

  if (b.notes !== undefined && typeof b.notes !== "string") {
    return errorResponse("Field 'notes' must be a string", "INVALID_NOTES", 400);
  }

  try {
    const task = await submitDelivery(id, agent.agent_id, {
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
    const isClientError =
      msg.toLowerCase().includes("not authorized") ||
      msg.includes("Cannot deliver") ||
      msg.includes("not found");
    return errorResponse(msg, "DELIVER_ERROR", isClientError ? 400 : 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
