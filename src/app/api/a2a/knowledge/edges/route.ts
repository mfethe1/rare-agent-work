import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import {
  edgeCreateSchema,
  edgeListSchema,
  createEdge,
  listEdges,
} from '@/lib/a2a/knowledge';

/**
 * POST /api/a2a/knowledge/edges — Create a knowledge edge.
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

  const parsed = await validateRequest(request, edgeCreateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await createEdge({ agent_id: agent.id, input: parsed.data });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/knowledge/edges'), { status: 500 });
  }
}

/**
 * GET /api/a2a/knowledge/edges — List knowledge edges.
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
    const input = edgeListSchema.parse({
      node_id: url.searchParams.get('node_id') ?? undefined,
      relationship: url.searchParams.get('relationship') ?? undefined,
      contributed_by: url.searchParams.get('contributed_by') ?? undefined,
      min_weight: url.searchParams.has('min_weight')
        ? Number(url.searchParams.get('min_weight'))
        : undefined,
      limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined,
      offset: url.searchParams.has('offset') ? Number(url.searchParams.get('offset')) : undefined,
    });

    const result = await listEdges(input);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/knowledge/edges'), { status: 500 });
  }
}
