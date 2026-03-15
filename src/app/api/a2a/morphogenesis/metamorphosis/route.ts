/**
 * POST /api/a2a/morphogenesis/metamorphosis — Propose agent metamorphosis
 * PATCH /api/a2a/morphogenesis/metamorphosis — Advance metamorphosis phase
 * GET /api/a2a/morphogenesis/metamorphosis?agent_id=X — Get metamorph state
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import {
  proposeMetamorph,
  advanceMetamorph,
  getMetamorphState,
  proposeMetamorphSchema,
  advanceMetamorphSchema,
} from '@/lib/a2a/morphogenesis';
import type { AgentSnapshot } from '@/lib/a2a/morphogenesis';
import { safeErrorBody } from '@/lib/api-errors';

export async function POST(req: NextRequest) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = proposeMetamorphSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const { agent_id, config, rationale } = parsed.data;

    const snapshot: AgentSnapshot = {
      agent_id,
      name: `Agent ${agent_id.slice(0, 8)}`,
      description: '',
      capabilities: [],
      trust_level: 'verified',
      metadata: {},
      snapshot_at: new Date().toISOString(),
    };

    const result = proposeMetamorph(agent_id, config, agent.id, rationale, snapshot);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('[a2a/morphogenesis/metamorphosis] POST error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'POST /api/a2a/morphogenesis/metamorphosis'), { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = advanceMetamorphSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const result = advanceMetamorph(parsed.data.agent_id, parsed.data.phase, parsed.data.progress);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('[a2a/morphogenesis/metamorphosis] PATCH error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'PATCH /api/a2a/morphogenesis/metamorphosis'), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agentId = req.nextUrl.searchParams.get('agent_id');
    if (!agentId) {
      return NextResponse.json({ error: 'agent_id query parameter required' }, { status: 400 });
    }

    const state = getMetamorphState(agentId);
    if (!state) {
      return NextResponse.json({ error: 'No metamorphosis in progress for this agent' }, { status: 404 });
    }

    return NextResponse.json({ state }, { status: 200 });
  } catch (err) {
    console.error('[a2a/morphogenesis/metamorphosis] GET error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'GET /api/a2a/morphogenesis/metamorphosis'), { status: 500 });
  }
}
