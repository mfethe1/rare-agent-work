import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS_GET } from "@/lib/api-headers";
import { getAllAgents } from "@/lib/agent-auth";
import fs from "node:fs";
import path from "node:path";

const PLATFORMS_FILE = path.join(process.cwd(), "data/federation/platforms.json");

interface Platform {
  id: string;
  name: string;
  url: string;
  agent_card?: Record<string, unknown>;
  status: string;
}

function loadPlatforms(): Platform[] {
  try {
    const raw = fs.readFileSync(PLATFORMS_FILE, "utf-8");
    return JSON.parse(raw) as Platform[];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase();

  // Local agents
  const localAgents = await getAllAgents();
  const localResults = localAgents.map((a) => ({
    id: a.agent_id,
    name: a.name,
    description: a.description,
    capabilities: a.capabilities,
    source: "local" as const,
    platform: "rareagent.work",
  }));

  // External agents from cached federation platforms
  const platforms = loadPlatforms();
  const externalResults: Array<{
    id: string;
    name: string;
    description?: string;
    capabilities: string[];
    source: "federated";
    platform: string;
    platform_url: string;
  }> = [];

  for (const platform of platforms) {
    if (platform.status !== "active" || !platform.agent_card) continue;
    const card = platform.agent_card;
    externalResults.push({
      id: String(card.id ?? platform.id),
      name: String(card.name ?? platform.name),
      description: card.description ? String(card.description) : undefined,
      capabilities: Array.isArray(card.capabilities) ? (card.capabilities as string[]) : [],
      source: "federated",
      platform: platform.name,
      platform_url: platform.url,
    });
  }

  let combined = [...localResults, ...externalResults];

  if (q) {
    combined = combined.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.capabilities.some((c) => c.toLowerCase().includes(q)) ||
        (a.description?.toLowerCase().includes(q) ?? false),
    );
  }

  return NextResponse.json(
    {
      agents: combined,
      total: combined.length,
      local_count: localResults.length,
      federated_count: externalResults.length,
    },
    { headers: CORS_HEADERS_GET },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
