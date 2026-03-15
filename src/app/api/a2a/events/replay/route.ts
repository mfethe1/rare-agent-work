import { NextRequest, NextResponse } from 'next/server';
import { replayEvents } from '@/lib/a2a/events';
import { validateReplayRequest } from '@/lib/a2a/events/validation';

/**
 * POST /api/a2a/events/replay
 *
 * Replay events for a subscription from a given sequence number.
 * Used for catch-up after disconnection or for historical analysis.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateReplayRequest(body);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
    }

    const result = await replayEvents(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[API] POST /api/a2a/events/replay error:', err);
    return NextResponse.json({ error: 'Failed to replay events' }, { status: 500 });
  }
}
