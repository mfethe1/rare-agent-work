/**
 * Evolution Proposal by ID — GET details + votes
 * Round 40
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/api-headers";
import { proposalStore } from "../route";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = getCorsHeaders();
  const { id } = await params;

  const proposal = await proposalStore.getById(id);
  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404, headers });
  }

  const supportVotes = proposal.votes.filter((v) => v.support);
  const opposeVotes = proposal.votes.filter((v) => !v.support);

  return NextResponse.json(
    {
      ...proposal,
      vote_summary: {
        total: proposal.votes.length,
        support: supportVotes.length,
        oppose: opposeVotes.length,
        score: proposal.vote_score,
        support_rate:
          proposal.votes.length > 0
            ? Math.round((supportVotes.length / proposal.votes.length) * 100)
            : 0,
      },
      recent_votes: proposal.votes.slice(-10).reverse(),
    },
    { headers },
  );
}
