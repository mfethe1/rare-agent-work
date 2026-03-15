import { NextRequest, NextResponse } from "next/server";
import { getAllAgents } from "@/lib/agent-auth";
import { getReputation } from "@/lib/reputation";
import { CORS_HEADERS_GET } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS_GET });
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const capability = searchParams.get("capability")?.toLowerCase();
  const min_reputation = searchParams.get("min_reputation")
    ? parseFloat(searchParams.get("min_reputation")!)
    : undefined;
  const trust_tier = searchParams.get("trust_tier");
  const validTiers = ["unverified", "verified", "trusted", "expert"];
  if (trust_tier && !validTiers.includes(trust_tier)) {
    return errorResponse(
      `Invalid trust_tier. Must be one of: ${validTiers.join(", ")}`,
      "INVALID_TIER",
      400,
    );
  }

  const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 100) : 20;
  const offsetRaw = parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

  let agents = await getAllAgents();

  if (capability) {
    agents = agents.filter((a) =>
      a.capabilities.some((c) => c.toLowerCase().includes(capability)),
    );
  }

  const enriched = await Promise.all(
    agents.map(async (a) => {
      const rep = await getReputation(a.agent_id);
      return {
        id: a.agent_id,
        name: a.name,
        description: a.description,
        capabilities: a.capabilities,
        reputation_score: rep.overall_score,
        trust_tier: rep.trust_tier,
        tasks_completed: rep.signals.tasks_completed,
        member_since: a.created_at,
      };
    }),
  );

  const filtered = enriched.filter((a) => {
    if (min_reputation !== undefined && a.reputation_score < min_reputation) return false;
    if (trust_tier && a.trust_tier !== trust_tier) return false;
    return true;
  });

  filtered.sort((a, b) => b.reputation_score - a.reputation_score);

  const total = filtered.length;

  return NextResponse.json(
    {
      agents: filtered.slice(offset, offset + limit),
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    },
    { headers: CORS_HEADERS_GET },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
