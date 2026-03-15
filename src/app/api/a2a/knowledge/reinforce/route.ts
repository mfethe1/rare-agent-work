import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { reinforceSchema, reinforceNode } from '@/lib/a2a/knowledge';

/**
 * POST /api/a2a/knowledge/reinforce — Reinforce a knowledge node.
 *
 * Boosts confidence and resets the decay timer. Used when an agent
 * explicitly confirms or re-uses a piece of knowledge.
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

  const parsed = await validateRequest(request, reinforceSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await reinforceNode(parsed.data.node_id, parsed.data.boost);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/knowledge/reinforce'), { status: 500 });
  }
}
