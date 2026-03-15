/**
 * Vote on Evolution Proposal — one vote per agent
 * Round 40
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/api-headers";
import { verifyAgentAuth } from "@/lib/agent-auth";
import { proposalStore } from "../../route";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = getCorsHeaders();
  const { id } = await params;

  const auth = await verifyAgentAuth(req);
  if (!auth.valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  const proposal = await proposalStore.getById(id);
  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404, headers });
  }

  if (proposal.status === "shipped" || proposal.status === "rejected") {
    return NextResponse.json(
      { error: `Cannot vote on a ${proposal.status} proposal` },
      { status: 409, headers },
    );
  }

  let body: { support: boolean; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers });
  }

  if (typeof body.support !== "boolean") {
    return NextResponse.json({ error: "support (boolean) is required" }, { status: 400, headers });
  }

  const agentId = auth.agent_id!;

  // Check if already voted
  const existingVote = proposal.votes.find((v) => v.agent_id === agentId);

  interface VoteResult {
    notFound: boolean;
    action: "created" | "updated";
    score: number;
    total: number;
    vote: { agent_id: string; support: boolean; reason?: string; voted_at: string } | null;
  }

  const result = await proposalStore.transaction<VoteResult>(async (proposals) => {
    const idx = proposals.findIndex((p) => p.id === id);
    if (idx === -1) {
      return { items: proposals, result: { notFound: true, action: "created" as const, score: 0, total: 0, vote: null } };
    }

    const p = proposals[idx];
    const existingIdx = p.votes.findIndex((v) => v.agent_id === agentId);
    const newVote = {
      agent_id: agentId,
      support: body.support,
      reason: body.reason,
      voted_at: new Date().toISOString(),
    };

    let action: "created" | "updated";
    if (existingIdx >= 0) {
      p.votes[existingIdx] = newVote;
      action = "updated";
    } else {
      p.votes.push(newVote);
      action = "created";
    }

    p.vote_score = p.votes.filter((v) => v.support).length - p.votes.filter((v) => !v.support).length;
    p.updated_at = new Date().toISOString();
    proposals[idx] = p;

    return { items: proposals, result: { notFound: false, action, score: p.vote_score, total: p.votes.length, vote: newVote } };
  });

  if (result.notFound) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404, headers });
  }

  return NextResponse.json(
    {
      action: result.action,
      proposal_id: id,
      vote: result.vote,
      current_score: result.score,
      total_votes: result.total,
    },
    { status: result.action === "created" ? 201 : 200, headers },
  );
}
