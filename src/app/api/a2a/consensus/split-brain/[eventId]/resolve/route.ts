import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { validateRequest } from '@/lib/api-validation';
import { ResolveSplitBrainSchema } from '@/lib/a2a/consensus/validation';
import { ConsensusEngine } from '@/lib/a2a/consensus/engine';

const engine = new ConsensusEngine();

/**
 * POST /api/a2a/consensus/split-brain/:eventId/resolve — Manually resolve a split-brain event.
 *
 * A privileged agent or human operator selects which partition's decision
 * should be canonical, reconciling the divergent states.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const { eventId } = await params;

  const parsed = await validateRequest(request, ResolveSplitBrainSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await engine.resolveSplitBrainManually(agent.id, eventId, parsed.data);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/consensus/split-brain/:eventId/resolve'),
      { status: 500 },
    );
  }
}
