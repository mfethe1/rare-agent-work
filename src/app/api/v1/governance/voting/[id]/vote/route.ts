import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS } from "@/lib/api-headers";
import { verifyApiKey } from "@/lib/agent-auth";
import fs from "node:fs";
import path from "node:path";
import type { Proposal } from "../../route";

const PROPOSALS_FILE = path.join(process.cwd(), "data/governance/proposals/proposals.json");

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }
  const agent = await verifyApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS });
  }

  const body = await req.json().catch(() => null);
  if (body?.option_index === undefined || typeof body.option_index !== "number") {
    return NextResponse.json({ error: "Missing required field: option_index" }, { status: 400, headers: CORS_HEADERS });
  }

  const proposals = loadProposals();
  const proposalIdx = proposals.findIndex((p) => p.id === id);
  if (proposalIdx === -1) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404, headers: CORS_HEADERS });
  }

  const proposal = proposals[proposalIdx];

  if (proposal.status === "closed" || new Date(proposal.voting_deadline) <= new Date()) {
    return NextResponse.json({ error: "Voting is closed for this proposal" }, { status: 409, headers: CORS_HEADERS });
  }

  if (body.option_index < 0 || body.option_index >= proposal.options.length) {
    return NextResponse.json(
      { error: `option_index must be 0–${proposal.options.length - 1}` },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // One vote per agent
  if (proposal.votes[agent.agent_id] !== undefined) {
    return NextResponse.json({ error: "You have already voted on this proposal" }, { status: 409, headers: CORS_HEADERS });
  }

  // Ensure vote_counts has right length
  if (!proposal.vote_counts || proposal.vote_counts.length !== proposal.options.length) {
    proposal.vote_counts = new Array(proposal.options.length).fill(0) as number[];
  }

  proposal.votes[agent.agent_id] = body.option_index;
  proposal.vote_counts[body.option_index] += 1;

  proposals[proposalIdx] = proposal;
  saveProposals(proposals);

  return NextResponse.json(
    {
      voted: true,
      option_index: body.option_index,
      option: proposal.options[body.option_index],
      vote_counts: proposal.vote_counts,
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
