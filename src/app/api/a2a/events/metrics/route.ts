import { NextResponse } from 'next/server';
import { getStreamMetrics } from '@/lib/a2a/events';

/**
 * GET /api/a2a/events/metrics
 *
 * Returns real-time metrics for the event streaming system:
 * throughput, delivery rates, latency, dead-letter depth, per-domain counts.
 */
export async function GET() {
  try {
    const metrics = await getStreamMetrics();
    return NextResponse.json({ metrics });
  } catch (err) {
    console.error('[API] GET /api/a2a/events/metrics error:', err);
    return NextResponse.json({ error: 'Failed to get stream metrics' }, { status: 500 });
  }
}
