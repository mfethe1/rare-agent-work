import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { createPopulation, listPopulations } from '@/lib/a2a/evolution/engine';
import { createPopulationSchema, listPopulationsSchema } from '@/lib/a2a/evolution/validation';

/**
 * POST /api/a2a/evolution — Create a new evolutionary population
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
    const parsed = createPopulationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = createPopulation({ owner_id: agent.id, input: parsed.data });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/evolution error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * GET /api/a2a/evolution — List evolutionary populations
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = listPopulationsSchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = listPopulations(agent.id, parsed.data.status);
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/a2a/evolution error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
