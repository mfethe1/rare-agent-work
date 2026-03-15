import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  meshPolicyCreateSchema,
  createMeshPolicy,
  listMeshPolicies,
} from '@/lib/a2a/mesh';

/**
 * POST /api/a2a/mesh/policies — Create a new mesh policy.
 *
 * Mesh policies define per-capability resilience configuration:
 * load balancing strategy, circuit breaker thresholds, retry/hedging policies.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  // Only partner agents can create mesh policies
  if (agent.trust_level !== 'partner') {
    return NextResponse.json(
      { error: 'Only partner-level agents can manage mesh policies.' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const parsed = meshPolicyCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await createMeshPolicy(parsed.data);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/mesh/policies'), { status: 500 });
  }
}

/**
 * GET /api/a2a/mesh/policies — List all mesh policies.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const result = await listMeshPolicies();

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json({ policies: result });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/mesh/policies'), { status: 500 });
  }
}
