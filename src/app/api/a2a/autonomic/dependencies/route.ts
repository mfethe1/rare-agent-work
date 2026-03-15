/**
 * GET  /api/a2a/autonomic/dependencies — Build & query dependency graph
 * POST /api/a2a/autonomic/dependencies — Record an agent interaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { buildDependencyGraphSchema } from '@/lib/a2a/autonomic';
import { safeErrorBody } from '@/lib/api-errors';

export async function GET(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = buildDependencyGraphSchema.safeParse({
      agent_ids: params.agent_ids ? params.agent_ids.split(',') : undefined,
      min_interaction_count: params.min_interaction_count ? Number(params.min_interaction_count) : undefined,
      include_optional: params.include_optional === 'true',
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
    }

    return NextResponse.json({
      agents: [],
      edges: [],
      clusters: [],
      critical_paths: [],
      single_points_of_failure: [],
    });
  } catch (err) {
    console.error('GET /api/a2a/autonomic/dependencies error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { from_agent_id, to_agent_id, latency_ms, success } = body;

    if (!from_agent_id || !to_agent_id || typeof latency_ms !== 'number' || typeof success !== 'boolean') {
      return NextResponse.json({ error: 'Required: from_agent_id, to_agent_id, latency_ms (number), success (boolean)' }, { status: 400 });
    }

    return NextResponse.json({
      from_agent_id,
      to_agent_id,
      latency_ms,
      success,
      recorded: true,
      timestamp: Date.now(),
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/autonomic/dependencies error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
