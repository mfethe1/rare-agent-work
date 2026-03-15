import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  circuitEventSchema,
  getCircuitBreaker,
  recordSuccess,
  recordFailure,
} from '@/lib/a2a/mesh';

/**
 * POST /api/a2a/mesh/circuit — Record a circuit breaker event (success or failure).
 *
 * Body: { agent_id, event: "success" | "failure" }
 *
 * The mesh automatically manages circuit breaker state transitions:
 *   - closed + failures → open (trips the breaker)
 *   - open + timeout → half_open (probe traffic allowed)
 *   - half_open + success → closed (recovered)
 *   - half_open + failure → open (still broken)
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const event = body.event as string;

    if (event !== 'success' && event !== 'failure') {
      return NextResponse.json({ error: 'event must be "success" or "failure"' }, { status: 400 });
    }

    const parsed = circuitEventSchema.safeParse({ agent_id: body.agent_id });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = event === 'success'
      ? await recordSuccess(parsed.data.agent_id)
      : await recordFailure(parsed.data.agent_id);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/mesh/circuit'), { status: 500 });
  }
}

/**
 * GET /api/a2a/mesh/circuit?agent_id=... — Get circuit breaker state for an agent.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id query parameter is required' }, { status: 400 });
    }

    const result = await getCircuitBreaker(agentId);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/mesh/circuit'), { status: 500 });
  }
}
