import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { recordOutcome, getOutcomes, RecordOutcomeSchema } from '@/lib/a2a/intelligence';

/**
 * POST /api/a2a/intelligence/outcomes — Record a strategy outcome
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
    const parsed = RecordOutcomeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const { strategyId, taskId, agentId, capability, ...result } = parsed.data;
    const outcome = recordOutcome(strategyId, taskId, agentId, capability, {
      ...result,
      contextSnapshot: result.contextSnapshot ?? {},
    });
    return NextResponse.json({ outcome }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/intelligence/outcomes error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * GET /api/a2a/intelligence/outcomes?strategyId=...&limit=...
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const strategyId = searchParams.get('strategyId');
    if (!strategyId) {
      return NextResponse.json({ error: 'strategyId is required' }, { status: 422 });
    }
    const limit = parseInt(searchParams.get('limit') ?? '100', 10);
    const outcomes = getOutcomes(strategyId, limit);
    return NextResponse.json({ outcomes });
  } catch (err) {
    console.error('GET /api/a2a/intelligence/outcomes error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
