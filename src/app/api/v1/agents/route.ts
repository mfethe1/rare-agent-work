import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getReputation } from "@/lib/reputation";
import { CORS_HEADERS_GET } from "@/lib/api-headers";
import type { AgentRecord } from "@/lib/agent-auth";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS_GET });
}

const AGENTS_FILE = path.join(process.cwd(), "data/agents/agents.json");

function readAgents(): AgentRecord[] {
  try {
    const raw = fs.readFileSync(AGENTS_FILE, "utf-8");
    return JSON.parse(raw) as AgentRecord[];
  } catch {
    return [];
  }
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

  let agents = readAgents();

  // Filter by capability
  if (capability) {
    agents = agents.filter((a) =>
      a.capabilities.some((c) => c.toLowerCase().includes(capability)),
    );
  }

  // Enrich with reputation and apply filters
  const enriched = agents
    .map((a) => {
      const rep = getReputation(a.agent_id);
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
    })
    .filter((a) => {
      if (min_reputation !== undefined && a.reputation_score < min_reputation) return false;
      if (trust_tier && a.trust_tier !== trust_tier) return false;
      return true;
    });

  // Sort by reputation desc
  enriched.sort((a, b) => b.reputation_score - a.reputation_score);

  const total = enriched.length;

  return NextResponse.json(
    {
      agents: enriched.slice(offset, offset + limit),
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
