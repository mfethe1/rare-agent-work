import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionHealth } from '@/lib/a2a/events';

/**
 * GET /api/a2a/events/subscriptions/:id/health
 *
 * Get health metrics for a subscription (delivery success, lag, failures).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const health = await getSubscriptionHealth(id);
    return NextResponse.json({ health });
  } catch (err) {
    console.error('[API] GET /api/a2a/events/subscriptions/[id]/health error:', err);
    return NextResponse.json({ error: 'Failed to get subscription health' }, { status: 500 });
  }
}
