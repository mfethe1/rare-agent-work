/**
 * GET    /api/a2a/correlations/:id — Get correlation context
 * PATCH  /api/a2a/correlations/:id — Update context status
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import {
  getCorrelationContext,
  completeCorrelationContext,
  failCorrelationContext,
  cancelCorrelationContext,
  CorrelationStatus,
} from '@/lib/a2a/events/correlation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticateAgent(request);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const context = await getCorrelationContext(id);
    if (!context) {
      return NextResponse.json({ error: 'Correlation context not found' }, { status: 404 });
    }

    return NextResponse.json(context);
  } catch (err) {
    console.error('[Correlations] GET/:id error:', err);
    return NextResponse.json(
      { error: 'Failed to get correlation context' },
      { status: 500 }
    );
  }
}

const STATUS_HANDLERS: Record<
  string,
  (id: string) => ReturnType<typeof completeCorrelationContext>
> = {
  completed: completeCorrelationContext,
  failed: failCorrelationContext,
  cancelled: cancelCorrelationContext,
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticateAgent(request);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const status = body.status as CorrelationStatus;

    const handler = STATUS_HANDLERS[status];
    if (!handler) {
      return NextResponse.json(
        { error: `Invalid status. Valid: ${Object.keys(STATUS_HANDLERS).join(', ')}` },
        { status: 400 }
      );
    }

    const context = await handler(id);
    return NextResponse.json(context);
  } catch (err) {
    console.error('[Correlations] PATCH/:id error:', err);
    return NextResponse.json(
      { error: 'Failed to update correlation context' },
      { status: 500 }
    );
  }
}
