/**
 * GET /api/a2a/traces/:traceId — Get full trace detail with all spans
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, getServiceDb } from '@/lib/a2a';
import { getTrace } from '@/lib/a2a/observability';

export async function GET(
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

    const db = getServiceDb();
    const trace = await getTrace(db, traceId);

    if (!trace) {
      return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
    }

    return NextResponse.json({ trace });
  } catch (err) {
    console.error('[a2a/traces/:id] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
