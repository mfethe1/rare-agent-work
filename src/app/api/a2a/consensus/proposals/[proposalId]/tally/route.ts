import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { ConsensusEngine } from '@/lib/a2a/consensus/engine';

const engine = new ConsensusEngine();

/**
 * GET /api/a2a/consensus/proposals/:proposalId/tally — Compute the current vote tally.
 *
 * Returns a real-time breakdown of votes, weights, and whether quorum
 * or threshold conditions have been met.
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
    const tally = await engine.computeTally(agent.id, proposalId);

    if (!tally) {
      return NextResponse.json({ error: 'Proposal not found.' }, { status: 404 });
    }

    return NextResponse.json(tally);
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'GET /api/a2a/consensus/proposals/:proposalId/tally'),
      { status: 500 },
    );
  }
}
