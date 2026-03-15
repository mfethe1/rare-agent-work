/**
 * POST  /api/a2a/metacognition/propagate — Propagate a validated improvement to peers
 * PATCH /api/a2a/metacognition/propagate — Record a peer's response to a propagation
 * GET   /api/a2a/metacognition/propagate — List propagations for an agent
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  propagateImprovement,
  recordPropagationResponse,
  getAgentPropagations,
  propagateImprovementSchema,
  recordPropagationResponseSchema,
} from '@/lib/a2a/metacognition';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = propagateImprovementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = propagateImprovement(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = recordPropagationResponseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = recordPropagationResponse(
      parsed.data.propagation_id,
      parsed.data.agent_id,
      parsed.data.action,
      parsed.data.improvement_delta,
    );
    if (!result) {
      return NextResponse.json({ error: 'Propagation not found' }, { status: 404 });
    }
    return NextResponse.json({ propagation: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get('agent_id');
    if (!agentId) {
      return NextResponse.json({ error: 'agent_id query parameter required' }, { status: 400 });
    }
    const propagations = getAgentPropagations(agentId);
    return NextResponse.json({ propagations, total: propagations.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
