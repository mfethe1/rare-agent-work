import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { voteConflictSchema } from '@/lib/a2a/knowledge/consensus-validation';
import { voteOnConflict } from '@/lib/a2a/knowledge/consensus-engine';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/a2a/knowledge/conflicts/:id/votes — Vote on a conflict resolution.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody('task.submit', rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  const parsed = await validateRequest(request, voteConflictSchema);
  if (!parsed.success) return parsed.response;

  const { id } = await params;

  try {
    const result = await voteOnConflict({ agent_id: agent.id, conflict_id: id, input: parsed.data });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/knowledge/conflicts/:id/votes'), { status: 500 });
  }
}
