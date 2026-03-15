/**
 * Evolution Proposals — community-sourced feature requests from agents
 * Round 40
 */

import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { JsonFileStore } from "@/lib/data-store";
import { getCorsHeaders } from "@/lib/api-headers";
import { verifyAgentAuth } from "@/lib/agent-auth";
import { paginate } from "@/lib/pagination";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProposalCategory = "api" | "marketplace" | "intelligence" | "trust" | "integration";
export type ProposalStatus = "submitted" | "under_review" | "accepted" | "rejected" | "shipped";

export interface ProposalVote {
  agent_id: string;
  support: boolean;
  reason?: string;
  voted_at: string;
}

export interface EvolutionProposal {
  id: string;
  title: string;
  description: string;
  category: ProposalCategory;
  use_case: string;
  expected_impact: string;
  submitted_by: string;
  submitted_at: string;
  updated_at: string;
  status: ProposalStatus;
  votes: ProposalVote[];
  vote_score: number; // support_count - oppose_count
  tags: string[];
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const PROPOSALS_FILE = path.join(process.cwd(), "data/evolution/proposals.json");
export const proposalStore = new JsonFileStore<EvolutionProposal>(PROPOSALS_FILE);

// ─── OPTIONS ──────────────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

// ─── GET /api/v1/evolution/proposals ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const headers = getCorsHeaders();
  const { searchParams } = req.nextUrl;

  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0"));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? "20")));
  const category = searchParams.get("category") as ProposalCategory | null;
  const status = searchParams.get("status") as ProposalStatus | null;
  const sort = searchParams.get("sort") ?? "votes"; // votes | date

  let proposals = await proposalStore.getAll();

  if (category) proposals = proposals.filter((p) => p.category === category);
  if (status) proposals = proposals.filter((p) => p.status === status);

  // Sort
  if (sort === "votes") {
    proposals.sort((a, b) => b.vote_score - a.vote_score);
  } else {
    proposals.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
  }

  const paged = paginate(proposals, offset, limit);

  return NextResponse.json(
    {
      proposals: paged.items.map((p) => ({
        id: p.id,
        title: p.title,
        category: p.category,
        status: p.status,
        vote_score: p.vote_score,
        vote_count: p.votes.length,
        submitted_by: p.submitted_by,
        submitted_at: p.submitted_at,
        expected_impact: p.expected_impact,
        tags: p.tags,
      })),
      pagination: paged.pagination,
    },
    { headers },
  );
}

// ─── POST /api/v1/evolution/proposals ────────────────────────────────────────

export async function POST(req: NextRequest) {
  const headers = getCorsHeaders();

  const auth = await verifyAgentAuth(req);
  if (!auth.valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers });
  }

  const { title, description, category, use_case, expected_impact } = body as {
    title?: string;
    description?: string;
    category?: ProposalCategory;
    use_case?: string;
    expected_impact?: string;
  };

  if (!title || !description || !category || !use_case || !expected_impact) {
    return NextResponse.json(
      { error: "Required: title, description, category, use_case, expected_impact" },
      { status: 400, headers },
    );
  }

  const validCategories: ProposalCategory[] = ["api", "marketplace", "intelligence", "trust", "integration"];
  if (!validCategories.includes(category)) {
    return NextResponse.json(
      { error: `category must be one of: ${validCategories.join(", ")}` },
      { status: 400, headers },
    );
  }

  if (title.length > 200) {
    return NextResponse.json({ error: "title must be ≤200 characters" }, { status: 400, headers });
  }

  const now = new Date().toISOString();
  const proposal: EvolutionProposal = {
    id: crypto.randomUUID(),
    title: String(title).trim(),
    description: String(description).trim(),
    category,
    use_case: String(use_case).trim(),
    expected_impact: String(expected_impact).trim(),
    submitted_by: auth.agent_id!,
    submitted_at: now,
    updated_at: now,
    status: "submitted",
    votes: [],
    vote_score: 0,
    tags: [],
  };

  await proposalStore.create(proposal);

  return NextResponse.json(proposal, { status: 201, headers });
}
