import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { runSimulation } from '@/lib/a2a/simulation/engine';

/**
 * POST /api/a2a/simulations/:id/run — Execute a simulation
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
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
    const { id } = await params;
    const result = await runSimulation(id);
    if (!result) {
      return NextResponse.json(
        { error: 'Simulation not found or not in a runnable state.' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      simulation_id: id,
      status: 'completed',
      result,
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('POST /api/a2a/simulations/:id/run error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
