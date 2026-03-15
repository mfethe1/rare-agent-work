import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { findContradictions } from '@/lib/a2a/knowledge';

/**
 * GET /api/a2a/knowledge/contradictions — List contradictions in the knowledge graph.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'read');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody('read', rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const url = new URL(request.url);
    const namespace = url.searchParams.get('namespace') ?? undefined;
    const limit = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : 50;
    const offset = url.searchParams.has('offset') ? Number(url.searchParams.get('offset')) : 0;

    const result = await findContradictions(namespace, limit, offset);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/knowledge/contradictions'), { status: 500 });
  }
}
