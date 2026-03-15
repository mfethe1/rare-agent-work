import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { deleteEdge } from '@/lib/a2a/knowledge';

/**
 * DELETE /api/a2a/knowledge/edges/:id — Delete a knowledge edge.
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
    const result = await deleteEdge(id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'DELETE /api/a2a/knowledge/edges/:id'), { status: 500 });
  }
}
