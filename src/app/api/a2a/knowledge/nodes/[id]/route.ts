import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import {
  nodeUpdateSchema,
  getNode,
  updateNode,
  deleteNode,
} from '@/lib/a2a/knowledge';

/**
 * GET /api/a2a/knowledge/nodes/:id — Get a single knowledge node.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'read');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody('read', rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const { id } = await params;
    const node = await getNode(id);
    if (!node) {
      return NextResponse.json({ error: 'Knowledge node not found' }, { status: 404 });
    }
    return NextResponse.json({ node });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/knowledge/nodes/:id'), { status: 500 });
  }
}

/**
 * PATCH /api/a2a/knowledge/nodes/:id — Update a knowledge node.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody('task.submit', rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  const parsed = await validateRequest(request, nodeUpdateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const { id } = await params;
    const result = await updateNode({ agent_id: agent.id, node_id: id, input: parsed.data });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'PATCH /api/a2a/knowledge/nodes/:id'), { status: 500 });
  }
}

/**
 * DELETE /api/a2a/knowledge/nodes/:id — Delete a knowledge node.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody('task.submit', rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const { id } = await params;
    const result = await deleteNode(id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'DELETE /api/a2a/knowledge/nodes/:id'), { status: 500 });
  }
}
