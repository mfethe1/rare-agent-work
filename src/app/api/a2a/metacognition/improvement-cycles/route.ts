/**
 * POST  /api/a2a/metacognition/improvement-cycles — Start an improvement cycle
 * GET   /api/a2a/metacognition/improvement-cycles — List cycles for an agent
 * PATCH /api/a2a/metacognition/improvement-cycles — Advance a cycle to next phase
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  startImprovementCycle,
  getAgentCycles,
  advanceImprovementCycle,
  startImprovementCycleSchema,
  advanceCycleSchema,
} from '@/lib/a2a/metacognition';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = startImprovementCycleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = startImprovementCycle(parsed.data);
    return NextResponse.json(result, { status: 201 });
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
    const cycles = getAgentCycles(agentId);
    return NextResponse.json({ cycles, total: cycles.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = advanceCycleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = advanceImprovementCycle(parsed.data.cycle_id);
    if (!result) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }
    return NextResponse.json({ cycle: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
