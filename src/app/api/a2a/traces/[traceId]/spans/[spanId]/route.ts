/**
 * PATCH /api/a2a/traces/:traceId/spans/:spanId — Update/end a span
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, getServiceDb } from '@/lib/a2a';
import { spanUpdateSchema } from '@/lib/a2a/observability';
import { annotateSpan, endSpan } from '@/lib/a2a/observability';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ traceId: string; spanId: string }> },
) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { traceId, spanId } = await params;
    if (!/^[0-9a-f]{32}$/.test(traceId)) {
      return NextResponse.json({ error: 'Invalid trace ID format' }, { status: 400 });
    }
    if (!/^[0-9a-f]{16}$/.test(spanId)) {
      return NextResponse.json({ error: 'Invalid span ID format' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = spanUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const db = getServiceDb();
    const { end: shouldEnd, status, error_message, error_code, attributes, events } = parsed.data;

    // First annotate if there are attributes/events to add
    if (attributes || events || (status && !shouldEnd)) {
      await annotateSpan(db, traceId, spanId, {
        attributes,
        events,
        status,
        error_message,
        error_code,
      });
    }

    // End the span if requested
    let duration_ms: number | null = null;
    let ended_at: string | null = null;
    if (shouldEnd) {
      const result = await endSpan(db, traceId, spanId, status ?? 'ok', error_message, error_code);
      duration_ms = result.duration_ms;
      ended_at = new Date().toISOString();
    }

    return NextResponse.json({
      span_id: spanId,
      status: status ?? 'unset',
      duration_ms,
      ended_at,
    });
  } catch (err) {
    console.error('[a2a/traces/:id/spans/:id] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
