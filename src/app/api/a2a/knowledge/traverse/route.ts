import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { traverseSchema, traverseGraph } from '@/lib/a2a/knowledge';

/**
 * POST /api/a2a/knowledge/traverse — Traverse the knowledge graph.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'read');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody('read', rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  const parsed = await validateRequest(request, traverseSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await traverseGraph(parsed.data);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/knowledge/traverse'), { status: 500 });
  }
}
