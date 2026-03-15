import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { appendEntry, getSpaceById } from "@/lib/spaces";
import { eventBus } from "@/lib/event-bus";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

const VALID_ENTRY_TYPES = ["text", "data", "reference"] as const;

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

  // Check space exists first
  const space = await getSpaceById(id);
  if (!space) {
    return errorResponse("Space not found", "NOT_FOUND", 404);
  }

  // Participant check
  if (!space.participants.includes(agent.agent_id)) {
    return errorResponse(
      "You are not a participant in this space",
      "FORBIDDEN",
      403,
    );
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
  if (!b.type || !VALID_ENTRY_TYPES.includes(b.type as typeof VALID_ENTRY_TYPES[number])) {
    return errorResponse(
      `Field 'type' must be one of: ${VALID_ENTRY_TYPES.join(", ")}`,
      "INVALID_TYPE",
      400,
    );
  }
  if (b.metadata !== undefined) {
    if (typeof b.metadata !== "object" || Array.isArray(b.metadata)) {
      return errorResponse("Field 'metadata' must be a key-value object", "INVALID_METADATA", 400);
    }
  }

  try {
    const { space: updatedSpace, entry } = await appendEntry(id, agent.agent_id, {
      content: (b.content as string).trim(),
      type: b.type as "text" | "data" | "reference",
      metadata: b.metadata as Record<string, string> | undefined,
    });

    // Publish SSE event
    eventBus.publish("space.entry_added", {
      space_id: updatedSpace.id,
      entry_id: entry.id,
      agent_id: agent.agent_id,
    });

    return NextResponse.json(
      { space_id: updatedSpace.id, entry },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    const isClientError = msg.includes("not found") || msg.includes("Not a participant");
    return errorResponse(msg, "WRITE_ERROR", isClientError ? 400 : 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
