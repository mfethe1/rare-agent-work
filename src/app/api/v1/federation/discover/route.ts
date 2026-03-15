import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS } from "@/lib/api-headers";
import fs from "node:fs";
import path from "node:path";

const PLATFORMS_FILE = path.join(process.cwd(), "data/federation/platforms.json");

interface Platform {
  id: string;
  name: string;
  url: string;
  agent_card_url: string;
  capabilities: string[];
  status: "active" | "pending" | "offline";
  discovered_at: string;
  agent_card?: Record<string, unknown>;
}

function loadPlatforms(): Platform[] {
  try {
    const raw = fs.readFileSync(PLATFORMS_FILE, "utf-8");
    return JSON.parse(raw) as Platform[];
  } catch {
    return [];
  }
}

function savePlatforms(platforms: Platform[]): void {
  fs.mkdirSync(path.dirname(PLATFORMS_FILE), { recursive: true });
  fs.writeFileSync(PLATFORMS_FILE, JSON.stringify(platforms, null, 2));
}

function slugify(url: string): string {
  return url.replace(/https?:\/\//, "").replace(/[^a-z0-9]/gi, "-").toLowerCase();
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "Missing required field: url" }, { status: 400, headers: CORS_HEADERS });
  }

  const baseUrl = body.url.replace(/\/$/, "");
  const agentCardUrl = `${baseUrl}/.well-known/agent.json`;

  // Fetch the remote agent card
  let agentCard: Record<string, unknown> | null = null;
  try {
    const res = await fetch(agentCardUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch agent card from ${agentCardUrl}: HTTP ${res.status}` },
        { status: 422, headers: CORS_HEADERS },
      );
    }
    agentCard = (await res.json()) as Record<string, unknown>;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Could not reach ${agentCardUrl}: ${msg}` },
      { status: 422, headers: CORS_HEADERS },
    );
  }

  // Validate minimal agent card schema
  if (!agentCard.name) {
    return NextResponse.json(
      { error: "Invalid agent card: missing required field 'name'" },
      { status: 422, headers: CORS_HEADERS },
    );
  }

  const platforms = loadPlatforms();
  const id = slugify(baseUrl);
  const existingIdx = platforms.findIndex((p) => p.id === id);

  const platform: Platform = {
    id,
    name: String(agentCard.name ?? id),
    url: baseUrl,
    agent_card_url: agentCardUrl,
    capabilities: Array.isArray(agentCard.capabilities)
      ? (agentCard.capabilities as string[])
      : [],
    status: "active",
    discovered_at: new Date().toISOString(),
    agent_card: agentCard,
  };

  if (existingIdx >= 0) {
    platforms[existingIdx] = platform;
  } else {
    platforms.push(platform);
  }

  savePlatforms(platforms);

  return NextResponse.json(
    { platform, imported: existingIdx < 0, updated: existingIdx >= 0 },
    { status: existingIdx < 0 ? 201 : 200, headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
