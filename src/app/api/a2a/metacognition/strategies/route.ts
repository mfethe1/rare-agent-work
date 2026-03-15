/**
 * POST /api/a2a/metacognition/strategies — Generate improvement strategies
 * GET  /api/a2a/metacognition/strategies — List strategies for an agent
 * PATCH /api/a2a/metacognition/strategies — Record test result or adopt a strategy
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  generateStrategies,
  getAgentStrategies,
  recordStrategyTestResult,
  adoptStrategy,
  generateStrategiesSchema,
  recordTestResultSchema,
  adoptStrategySchema,
} from '@/lib/a2a/metacognition';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = generateStrategiesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = generateStrategies(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get('agent_id');
    if (!agentId) {
      return NextResponse.json({ error: 'agent_id query parameter required' }, { status: 400 });
    }
    const status = url.searchParams.get('status') as Parameters<typeof getAgentStrategies>[1] | undefined;
    const strategies = getAgentStrategies(agentId, status ?? undefined);
    return NextResponse.json({ strategies, total: strategies.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;

    if (action === 'test') {
      const parsed = recordTestResultSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      const { strategy_id, ...rest } = parsed.data;
      const result = recordStrategyTestResult(strategy_id, { ...rest, tested_at: new Date().toISOString() });
      if (!result) {
        return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
      }
      return NextResponse.json({ strategy: result });
    }

    if (action === 'adopt') {
      const parsed = adoptStrategySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      const result = adoptStrategy(parsed.data.strategy_id);
      if (!result) {
        return NextResponse.json({ error: 'Strategy not found or not validated' }, { status: 404 });
      }
      return NextResponse.json({ strategy: result });
    }

    return NextResponse.json({ error: 'action must be "test" or "adopt"' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
