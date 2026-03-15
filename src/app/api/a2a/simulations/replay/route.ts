import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { replaySimulation } from '@/lib/a2a/simulation/engine';
import { replaySimulationSchema } from '@/lib/a2a/simulation/validation';

/**
 * POST /api/a2a/simulations/replay — Replay a production incident as a simulation
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = checkRateLimit(agent.id, agent.trust_level ?? 'untrusted', 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody(rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const body = await request.json();
    const parsed = replaySimulationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await replaySimulation(agent.id, parsed.data);
    if (!result) {
      return NextResponse.json(safeErrorBody(), { status: 500 });
    }

    return NextResponse.json({
      simulation_id: result.simulation_id,
      twin_ids: result.twin_ids,
      events_captured: result.events_captured,
      status: 'ready',
      created_at: result.created_at,
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/simulations/replay error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
