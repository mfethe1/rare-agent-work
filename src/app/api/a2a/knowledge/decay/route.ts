import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { applyDecay } from '@/lib/a2a/knowledge';

/**
 * POST /api/a2a/knowledge/decay — Trigger confidence decay on stale knowledge.
 *
 * Reduces confidence of knowledge nodes that haven't been accessed recently.
 * Prunes nodes that fall below the minimum confidence threshold.
 * Intended to be called periodically (e.g., via cron or scheduled job).
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody('task.submit', rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const result = await applyDecay();
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/knowledge/decay'), { status: 500 });
  }
}
