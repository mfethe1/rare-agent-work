import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { validateRequest } from '@/lib/api-validation';
import { ExecuteProposalSchema } from '@/lib/a2a/consensus/validation';
import { ConsensusEngine } from '@/lib/a2a/consensus/engine';

const engine = new ConsensusEngine();

/**
 * POST /api/a2a/consensus/proposals/:proposalId/execute — Execute an accepted proposal.
 *
 * Triggers the side-effects or actions described in the proposal after
 * it has been resolved and accepted by the council.
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

  const parsed = await validateRequest(request, ExecuteProposalSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await engine.executeProposal(agent.id, proposalId, parsed.data);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/consensus/proposals/:proposalId/execute'),
      { status: 500 },
    );
  }
}
