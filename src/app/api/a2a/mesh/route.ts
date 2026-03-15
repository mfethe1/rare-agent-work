import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  meshRouteSchema,
  routeThroughMesh,
  getMeshHealth,
} from '@/lib/a2a/mesh';

/**
 * POST /api/a2a/mesh — Route a task through the service mesh.
 *
 * Given a capability and candidate agent IDs, the mesh applies circuit breakers,
 * health-aware load balancing, and returns the optimal agent with full resilience
 * metadata (retry policy, hedging policy, excluded agents, health snapshots).
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = meshRouteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await routeThroughMesh(parsed.data);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/mesh'), { status: 500 });
  }
}

/**
 * GET /api/a2a/mesh — Mesh health dashboard.
 *
 * Returns all agents' health snapshots, active mesh policies, and a summary
 * of the mesh's overall health (healthy/degraded/circuit-open counts).
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const result = await getMeshHealth();

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/mesh'), { status: 500 });
  }
}
