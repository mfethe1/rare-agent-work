import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { getConflict } from '@/lib/a2a/knowledge/consensus-engine';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/a2a/knowledge/conflicts/:id — Get conflict details with tally and votes.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'read');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody('read', rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  const { id } = await params;

  try {
    const result = await getConflict(id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/knowledge/conflicts/:id'), { status: 500 });
  }
}
