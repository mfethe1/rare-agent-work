import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import {
  registerStrategy,
  listStrategies,
  RegisterStrategySchema,
} from '@/lib/a2a/intelligence';

/**
 * POST /api/a2a/intelligence/strategies — Register a new strategy
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
    const parsed = RegisterStrategySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const { agentId, capability, name, description, parameters, parentId } = parsed.data;
    const strategy = registerStrategy(agentId, capability, name, description, parameters, parentId);
    return NextResponse.json({ strategy }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/intelligence/strategies error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * GET /api/a2a/intelligence/strategies?agentId=...&capability=...
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') ?? agent.id;
    const capability = searchParams.get('capability') ?? undefined;
    const strategies = listStrategies(agentId, capability);
    return NextResponse.json({ strategies });
  } catch (err) {
    console.error('GET /api/a2a/intelligence/strategies error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
