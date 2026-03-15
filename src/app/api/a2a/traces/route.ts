/**
 * POST /api/a2a/traces — Start a new distributed trace
 * GET  /api/a2a/traces — List/search traces
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, getServiceDb } from '@/lib/a2a';
import { traceStartSchema, traceListSchema } from '@/lib/a2a/observability';
import { startTrace, listTraces } from '@/lib/a2a/observability';

export async function POST(req: NextRequest) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = traceStartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { operation, kind, attributes, parent_context } = parsed.data;
    const db = getServiceDb();

    const result = await startTrace(db, agent.id, operation, kind, attributes, parent_context);

    return NextResponse.json(
      {
        trace_id: result.trace_id,
        root_span_id: result.root_span_id,
        context: result.context,
        started_at: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[a2a/traces] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = req.nextUrl.searchParams;
    const input: Record<string, unknown> = {};
    if (url.get('agent_id')) input.agent_id = url.get('agent_id');
    if (url.get('operation')) input.operation = url.get('operation');
    if (url.get('has_errors')) input.has_errors = url.get('has_errors') === 'true';
    if (url.get('min_duration_ms')) input.min_duration_ms = Number(url.get('min_duration_ms'));
    if (url.get('max_duration_ms')) input.max_duration_ms = Number(url.get('max_duration_ms'));
    if (url.get('started_after')) input.started_after = url.get('started_after');
    if (url.get('started_before')) input.started_before = url.get('started_before');
    if (url.get('limit')) input.limit = Number(url.get('limit'));
    if (url.get('offset')) input.offset = Number(url.get('offset'));

    const parsed = traceListSchema.safeParse(input);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const db = getServiceDb();
    const result = await listTraces(db, parsed.data);

    return NextResponse.json({ traces: result.traces, count: result.count });
  } catch (err) {
    console.error('[a2a/traces] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
