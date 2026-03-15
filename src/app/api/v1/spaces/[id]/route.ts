import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { getSpaceWithPaginatedEntries } from "@/lib/spaces";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = req.nextUrl;

  // Optional auth — needed to view invite-only spaces
  let agentId: string | undefined;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const agent = await verifyApiKey(authHeader.slice(7));
    if (agent) agentId = agent.agent_id;
  }

  const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 100) : 20;
  const offsetRaw = parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

  const space = await getSpaceWithPaginatedEntries(id, { limit, offset });

  if (!space) {
    return errorResponse("Space not found", "NOT_FOUND", 404);
  }

  // Access check for invite-only spaces
  if (space.access === "invite" && (!agentId || !space.participants.includes(agentId))) {
    return errorResponse("Access denied — this space is invite-only", "FORBIDDEN", 403);
  }

  return NextResponse.json(
    {
      ...space,
      pagination: {
        total: space.total_entries,
        limit,
        offset,
        has_more: offset + limit < space.total_entries,
      },
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
