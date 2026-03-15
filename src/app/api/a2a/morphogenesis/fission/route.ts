/**
 * POST /api/a2a/morphogenesis/fission — Propose or execute agent fission
 * DELETE /api/a2a/morphogenesis/fission — Reunify fissioned agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import {
  proposeFission,
  executeFission,
  reunify,
  proposeFissionSchema,
  reunifySchema,
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
      const result = executeFission(event_id);
      return NextResponse.json(result, { status: 200 });
    }

    const parsed = proposeFissionSchema.safeParse(body);
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

    const event = proposeFission(agent_id, config, agent.id, rationale, snapshot);
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    console.error('[a2a/morphogenesis/fission] POST error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'POST /api/a2a/morphogenesis/fission'), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = reunifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const result = reunify(parsed.data.fission_event_id, agent.id, parsed.data.reason);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('[a2a/morphogenesis/fission] DELETE error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'DELETE /api/a2a/morphogenesis/fission'), { status: 500 });
  }
}
