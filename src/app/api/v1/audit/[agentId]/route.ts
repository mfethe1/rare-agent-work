import { NextRequest, NextResponse } from "next/server";
import { getAuditLog } from "@/lib/audit";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

/**
 * Public audit trail for any agent.
 * Limited to non-sensitive actions: task completions, challenge passes, contract completions.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  const { searchParams } = req.nextUrl;
  const since = searchParams.get("since") ?? undefined;
  const until = searchParams.get("until") ?? undefined;
  const limitRaw = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 200) : 50;

  const entries = await getAuditLog({
    agent_id: agentId,
    since,
    until,
    limit,
    public_only: true,
  });

  return NextResponse.json(
    {
      agent_id: agentId,
      entries,
      total: entries.length,
      note: "Showing public actions only: task completions, challenge passes, contract completions",
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
