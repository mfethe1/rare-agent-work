import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { voteOnRound } from '@/lib/a2a/ensemble/engine';
import { voteSchema } from '@/lib/a2a/ensemble/validation';

/**
 * POST /api/a2a/ensembles/:ensembleId/consensus/:roundId/votes — Vote on a consensus round
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ ensembleId: string; roundId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = checkRateLimit(agent.id, agent.trust_level ?? 'untrusted', 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody(rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const { ensembleId, roundId } = await params;
    const body = await request.json();
    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await voteOnRound({
      voter_agent_id: agent.id,
      ensemble_id: ensembleId,
      round_id: roundId,
      input: parsed.data,
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/a2a/ensembles/:id/consensus/:roundId/votes error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
