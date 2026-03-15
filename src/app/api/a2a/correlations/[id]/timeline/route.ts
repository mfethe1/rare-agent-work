/**
 * GET /api/a2a/correlations/:id/timeline — Get chronological event timeline
 *
 * Returns events in time order with relative timestamps and causal parent
 * references. Ideal for activity feeds, debugging, and audit logs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { getCorrelationTimeline } from '@/lib/a2a/events/correlation';

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
    const timeline = await getCorrelationTimeline(id);

    return NextResponse.json({
      correlation_id: id,
      entries: timeline,
      count: timeline.length,
      total_duration_ms: timeline.length >= 2
        ? timeline[timeline.length - 1].relative_time_ms
        : 0,
    });
  } catch (err) {
    console.error('[Correlations] GET/:id/timeline error:', err);
    return NextResponse.json(
      { error: 'Failed to build timeline' },
      { status: 500 }
    );
  }
}
