import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { createSimulation, listSimulations } from '@/lib/a2a/simulation/engine';
import { createSimulationSchema, listSimulationsSchema } from '@/lib/a2a/simulation/validation';

/**
 * POST /api/a2a/simulations — Create a simulation environment with digital twins
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
    const parsed = createSimulationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await createSimulation(agent.id, parsed.data);
    if (!result) {
      return NextResponse.json(safeErrorBody(), { status: 500 });
    }

    return NextResponse.json({
      simulation_id: result.simulation_id,
      twin_ids: result.twin_ids,
      status: 'ready',
      created_at: result.created_at,
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/simulations error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * GET /api/a2a/simulations — List simulation environments
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = listSimulationsSchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      tag: searchParams.get('tag') ?? undefined,
      limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const simulations = await listSimulations(parsed.data);
    return NextResponse.json({ simulations, count: simulations.length });
  } catch (err) {
    console.error('GET /api/a2a/simulations error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
