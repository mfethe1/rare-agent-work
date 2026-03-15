import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { validateRequest } from '@/lib/api-validation';
import { UpdateConvictionSchema } from '@/lib/a2a/consensus/validation';
import { ConsensusEngine } from '@/lib/a2a/consensus/engine';

const engine = new ConsensusEngine();

/**
 * POST /api/a2a/consensus/proposals/:proposalId/conviction — Update conviction voting signal.
 *
 * Allows an agent to continuously signal their conviction for a proposal,
 * accumulating weight over time in conviction-based voting mechanisms.
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

  const parsed = await validateRequest(request, UpdateConvictionSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await engine.updateConviction(agent.id, proposalId, parsed.data);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/consensus/proposals/:proposalId/conviction'),
      { status: 500 },
    );
  }
}
