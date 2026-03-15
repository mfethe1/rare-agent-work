import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { validateRequest } from '@/lib/api-validation';
import { CastVoteSchema } from '@/lib/a2a/consensus/validation';
import { ConsensusEngine } from '@/lib/a2a/consensus/engine';

const engine = new ConsensusEngine();

/**
 * POST /api/a2a/consensus/proposals/:proposalId/vote — Cast a vote on a proposal.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const { proposalId } = await params;

  const parsed = await validateRequest(request, CastVoteSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await engine.castVote(agent.id, proposalId, parsed.data);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/consensus/proposals/:proposalId/vote'),
      { status: 500 },
    );
  }
}

/**
 * GET /api/a2a/consensus/proposals/:proposalId/vote — Get all votes for a proposal.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const { proposalId } = await params;

  try {
    const votes = await engine.getVotes(agent.id, proposalId);
    return NextResponse.json({ votes, count: votes.length });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'GET /api/a2a/consensus/proposals/:proposalId/vote'),
      { status: 500 },
    );
  }
}
