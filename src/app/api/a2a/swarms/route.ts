import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { createSwarm, listSwarms } from '@/lib/a2a/swarm/engine';
import { createSwarmSchema, listSwarmsSchema } from '@/lib/a2a/swarm/validation';

/**
 * POST /api/a2a/swarms — Create a new swarm
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
    const parsed = createSwarmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await createSwarm({ creator_agent_id: agent.id, input: parsed.data });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/swarms error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * GET /api/a2a/swarms — List swarms
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = listSwarmsSchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      domain: searchParams.get('domain') ?? undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await listSwarms(parsed.data);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/a2a/swarms error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
