/**
 * POST /api/a2a/morphogenesis/graft — Propose or execute capability graft
 * DELETE /api/a2a/morphogenesis/graft — Revoke an active graft
 * PATCH /api/a2a/morphogenesis/graft — Record graft invocation
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import {
  proposeGraft,
  executeGraft,
  revokeGraft,
  recordGraftInvocation,
  proposeGraftSchema,
  revokeGraftSchema,
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
      const result = executeGraft(event_id);
      return NextResponse.json(result, { status: 200 });
    }

    const parsed = proposeGraftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const { config, rationale } = parsed.data;

    const makeSnapshot = (id: string): AgentSnapshot => ({
      agent_id: id,
      name: `Agent ${id.slice(0, 8)}`,
      description: '',
      capabilities: [],
      trust_level: 'verified',
      metadata: {},
      snapshot_at: new Date().toISOString(),
    });

    const event = proposeGraft(
      config,
      agent.id,
      rationale,
      makeSnapshot(config.donor_id),
      makeSnapshot(config.recipient_id),
    );

    const needsDonorConsent = config.donor_id !== agent.id;
    return NextResponse.json({ event, needs_donor_consent: needsDonorConsent }, { status: 201 });
  } catch (err) {
    console.error('[a2a/morphogenesis/graft] POST error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'POST /api/a2a/morphogenesis/graft'), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = revokeGraftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const graft = revokeGraft(parsed.data.graft_id, parsed.data.reason);
    return NextResponse.json({ graft }, { status: 200 });
  } catch (err) {
    console.error('[a2a/morphogenesis/graft] DELETE error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'DELETE /api/a2a/morphogenesis/graft'), { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { graft_id } = await req.json();
    if (!graft_id) {
      return NextResponse.json({ error: 'graft_id required' }, { status: 400 });
    }

    const graft = recordGraftInvocation(graft_id);
    return NextResponse.json({ graft }, { status: 200 });
  } catch (err) {
    console.error('[a2a/morphogenesis/graft] PATCH error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'PATCH /api/a2a/morphogenesis/graft'), { status: 500 });
  }
}
