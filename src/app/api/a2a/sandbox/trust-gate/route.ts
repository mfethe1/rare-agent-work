import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { evaluateTrustGate } from '@/lib/a2a/sandbox/engine';
import { trustGateSchema } from '@/lib/a2a/sandbox/validation';

/**
 * POST /api/a2a/sandbox/trust-gate — Evaluate trust escalation
 *
 * Agents must pass sandbox evaluation campaigns before their trust level
 * can be escalated. This endpoint evaluates whether the agent's campaign
 * results meet the requirements for the requested trust level.
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
    const parsed = trustGateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const evaluation = await evaluateTrustGate(parsed.data);
    return NextResponse.json({ evaluation });
  } catch (err) {
    console.error('POST /api/a2a/sandbox/trust-gate error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
