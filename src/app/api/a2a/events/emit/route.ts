import { NextRequest, NextResponse } from 'next/server';
import { emitEvent } from '@/lib/a2a/events';
import { validateEmitEventParams } from '@/lib/a2a/events/validation';

/**
 * POST /api/a2a/events/emit
 *
 * Emit a new event into the platform event stream.
 * Used by internal services (task engine, contract engine, etc.) to broadcast state changes.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateEmitEventParams(body);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
    }

    const event = await emitEvent(body);
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    console.error('[API] POST /api/a2a/events/emit error:', err);
    return NextResponse.json({ error: 'Failed to emit event' }, { status: 500 });
  }
}
