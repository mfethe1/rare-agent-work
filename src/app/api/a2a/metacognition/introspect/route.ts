/**
 * POST /api/a2a/metacognition/introspect — Submit introspection report for a completed task
 * GET  /api/a2a/metacognition/introspect — Get introspection reports for an agent
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  introspect,
  getAgentReports,
  introspectSchema,
} from '@/lib/a2a/metacognition';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = introspectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = introspect(parsed.data);
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
    const reports = getAgentReports(agentId);
    return NextResponse.json({ reports, total: reports.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
