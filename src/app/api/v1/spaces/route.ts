import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { createSpace, getSpaces } from "@/lib/spaces";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  // Optional auth — if provided, includes agent's private spaces too
  let agentId: string | undefined;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const agent = await verifyApiKey(authHeader.slice(7));
    if (agent) agentId = agent.agent_id;
  }

  const spaces = await getSpaces(agentId);

  return NextResponse.json(
    {
      spaces: spaces.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        created_by: s.created_by,
        participants_count: s.participants.length,
        access: s.access,
        entry_count: s.entries.length,
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
      total: spaces.length,
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
  if (!b.description || typeof b.description !== "string") {
    return errorResponse("Field 'description' is required", "MISSING_DESCRIPTION", 400);
  }
  if (!b.access || !["public", "invite"].includes(b.access as string)) {
    return errorResponse("Field 'access' must be 'public' or 'invite'", "INVALID_ACCESS", 400);
  }
  if (b.invited_agents !== undefined && !Array.isArray(b.invited_agents)) {
    return errorResponse("Field 'invited_agents' must be an array", "INVALID_INVITED", 400);
  }

  const space = await createSpace({
    name: b.name as string,
    description: b.description as string,
    created_by: agent.agent_id,
    access: b.access as "public" | "invite",
    invited_agents: b.invited_agents as string[] | undefined,
  });

  return NextResponse.json(space, { status: 201, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
