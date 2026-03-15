import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { sensePheromones } from '@/lib/a2a/swarm/engine';
import { sensePheromoneSchema } from '@/lib/a2a/swarm/validation';

/**
 * POST /api/a2a/swarms/:swarmId/sense — Sense nearby pheromones from current position
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ swarmId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { swarmId } = await params;
    const body = await request.json();
    const parsed = sensePheromoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await sensePheromones({ swarm_id: swarmId, agent_id: agent.id, input: parsed.data });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/a2a/swarms/:id/sense error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
