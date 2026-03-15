import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import {
  nodeCreateSchema,
  nodeSearchSchema,
  createNode,
  searchNodes,
} from '@/lib/a2a/knowledge';

/**
 * POST /api/a2a/knowledge/nodes — Create a knowledge node.
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

  const parsed = await validateRequest(request, nodeCreateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await createNode({ agent_id: agent.id, input: parsed.data });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/knowledge/nodes'), { status: 500 });
  }
}

/**
 * GET /api/a2a/knowledge/nodes — Search knowledge nodes.
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
    const input = nodeSearchSchema.parse({
      node_type: url.searchParams.get('node_type') ?? undefined,
      namespace: url.searchParams.get('namespace') ?? undefined,
      contributed_by: url.searchParams.get('contributed_by') ?? undefined,
      min_confidence: url.searchParams.has('min_confidence')
        ? Number(url.searchParams.get('min_confidence'))
        : undefined,
      tag: url.searchParams.get('tag') ?? undefined,
      name_contains: url.searchParams.get('name_contains') ?? undefined,
      limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined,
      offset: url.searchParams.has('offset') ? Number(url.searchParams.get('offset')) : undefined,
    });

    const result = await searchNodes(input);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/knowledge/nodes'), { status: 500 });
  }
}
