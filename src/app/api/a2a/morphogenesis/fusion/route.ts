/**
 * POST /api/a2a/morphogenesis/fusion — Propose or execute agent fusion
 * DELETE /api/a2a/morphogenesis/fusion — Defuse a composite agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import {
  proposeFusion,
  executeFusion,
  defuse,
  proposeFusionSchema,
  defuseSchema,
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
      const result = executeFusion(event_id);
      return NextResponse.json(result, { status: 200 });
    }

    // Default: propose fusion
    const parsed = proposeFusionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const { agent_ids, config, rationale } = parsed.data;

    // Build minimal snapshots (in production, fetch from agent registry)
    const snapshots: AgentSnapshot[] = agent_ids.map(id => ({
      agent_id: id,
      name: `Agent ${id.slice(0, 8)}`,
      description: '',
      capabilities: [],
      trust_level: 'verified',
      metadata: {},
      snapshot_at: new Date().toISOString(),
    }));

    const event = proposeFusion(agent_ids, config, agent.id, rationale, snapshots);

    const pendingConsent = agent_ids.filter(id => id !== agent.id);
    return NextResponse.json({ event, pending_consent: pendingConsent }, { status: 201 });
  } catch (err) {
    console.error('[a2a/morphogenesis/fusion] POST error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'POST /api/a2a/morphogenesis/fusion'), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = defuseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const result = defuse(parsed.data.composite_agent_id, agent.id, parsed.data.reason);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('[a2a/morphogenesis/fusion] DELETE error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'DELETE /api/a2a/morphogenesis/fusion'), { status: 500 });
  }
}
