/**
 * POST /api/a2a/morphogenesis/replication — Propose or execute agent replication
 * GET /api/a2a/morphogenesis/replication?progenitor_id=X — List replicas
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import {
  proposeReplication,
  executeReplication,
  getAgentReplicas,
  proposeReplicationSchema,
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
    const { action } = body;

    if (action === 'execute') {
      const { event_id } = body;
      if (!event_id) {
        return NextResponse.json({ error: 'event_id required for execution' }, { status: 400 });
      }
      const result = executeReplication(event_id);
      return NextResponse.json(result, { status: 200 });
    }

    const parsed = proposeReplicationSchema.safeParse(body);
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

    const event = proposeReplication(agent_id, config, agent.id, rationale, snapshot);
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    console.error('[a2a/morphogenesis/replication] POST error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'POST /api/a2a/morphogenesis/replication'), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const progenitorId = req.nextUrl.searchParams.get('progenitor_id');
    if (!progenitorId) {
      return NextResponse.json({ error: 'progenitor_id query parameter required' }, { status: 400 });
    }

    const agentReplicas = getAgentReplicas(progenitorId);
    return NextResponse.json({ replicas: agentReplicas, total: agentReplicas.length }, { status: 200 });
  } catch (err) {
    console.error('[a2a/morphogenesis/replication] GET error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'GET /api/a2a/morphogenesis/replication'), { status: 500 });
  }
}
