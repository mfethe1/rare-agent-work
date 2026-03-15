import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { depositPheromone } from '@/lib/a2a/swarm/engine';
import { depositPheromoneSchema } from '@/lib/a2a/swarm/validation';

/**
 * POST /api/a2a/swarms/:swarmId/pheromones — Deposit a pheromone signal
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ swarmId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = checkRateLimit(agent.id, agent.trust_level ?? 'untrusted', 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody(rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const { swarmId } = await params;
    const body = await request.json();
    const parsed = depositPheromoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await depositPheromone({ swarm_id: swarmId, agent_id: agent.id, input: parsed.data });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/swarms/:id/pheromones error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
