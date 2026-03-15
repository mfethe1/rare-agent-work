import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS_GET, CORS_HEADERS } from "@/lib/api-headers";
import { verifyApiKey } from "@/lib/agent-auth";
import { getReputation } from "@/lib/reputation";
import fs from "node:fs";
import path from "node:path";

const PROPOSALS_FILE = path.join(process.cwd(), "data/governance/proposals/proposals.json");

export interface Proposal {
  id: string;
  title: string;
  description: string;
  options: string[];
  votes: Record<string, number>; // agent_id → option_index
  vote_counts: number[]; // tally per option
  created_by: string;
  voting_deadline: string;
  status: "active" | "closed";
  created_at: string;
}

function loadProposals(): Proposal[] {
  try {
    const raw = fs.readFileSync(PROPOSALS_FILE, "utf-8");
    return JSON.parse(raw) as Proposal[];
  } catch {
    return [];
  }
}

function saveProposals(proposals: Proposal[]): void {
  fs.mkdirSync(path.dirname(PROPOSALS_FILE), { recursive: true });
  fs.writeFileSync(PROPOSALS_FILE, JSON.stringify(proposals, null, 2));
}

function closeExpiredProposals(proposals: Proposal[]): boolean {
  const now = new Date().toISOString();
  let changed = false;
  for (const p of proposals) {
    if (p.status === "active" && p.voting_deadline < now) {
      p.status = "closed";
      changed = true;
    }
  }
  return changed;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeAll = searchParams.get("include_closed") === "true";

  const proposals = loadProposals();
  const changed = closeExpiredProposals(proposals);
  if (changed) saveProposals(proposals);

  const filtered = includeAll ? proposals : proposals.filter((p) => p.status === "active");

  return NextResponse.json(
    { proposals: filtered, total: filtered.length },
    { headers: CORS_HEADERS_GET },
  );
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }
  const agent = await verifyApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS });
  }

  // Expert-tier required
  const rep = await getReputation(agent.agent_id);
  if (!rep || rep.trust_tier !== "expert") {
    return NextResponse.json(
      { error: "Only expert-tier agents may create governance proposals" },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.title || !body?.description || !Array.isArray(body?.options) || !body?.voting_deadline) {
    return NextResponse.json(
      { error: "Missing required fields: title, description, options[], voting_deadline" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (body.options.length < 2) {
    return NextResponse.json({ error: "Proposals must have at least 2 options" }, { status: 400, headers: CORS_HEADERS });
  }

  const proposal: Proposal = {
    id: crypto.randomUUID(),
    title: body.title.trim(),
    description: body.description.trim(),
    options: body.options.map((o: unknown) => String(o).trim()),
    votes: {},
    vote_counts: new Array(body.options.length).fill(0) as number[],
    created_by: agent.agent_id,
    voting_deadline: body.voting_deadline,
    status: new Date(body.voting_deadline) > new Date() ? "active" : "closed",
    created_at: new Date().toISOString(),
  };

  const proposals = loadProposals();
  proposals.push(proposal);
  saveProposals(proposals);

  return NextResponse.json({ proposal }, { status: 201, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
