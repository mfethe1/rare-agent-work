/**
 * POST /api/a2a/traces/:traceId/spans — Create a child span
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, getServiceDb } from '@/lib/a2a';
import { spanCreateSchema } from '@/lib/a2a/observability';
import { createSpan } from '@/lib/a2a/observability';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ traceId: string }> },
) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { traceId } = await params;
    if (!/^[0-9a-f]{32}$/.test(traceId)) {
      return NextResponse.json({ error: 'Invalid trace ID format' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = spanCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { parent_span_id, operation, kind, attributes, links } = parsed.data;
    const db = getServiceDb();

    const result = await createSpan(
      db,
      traceId,
      parent_span_id,
      agent.id,
      operation,
      kind,
      attributes,
      links,
    );

    return NextResponse.json(
      {
        span_id: result.span_id,
        trace_id: traceId,
        context: result.context,
        started_at: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[a2a/traces/:id/spans] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
