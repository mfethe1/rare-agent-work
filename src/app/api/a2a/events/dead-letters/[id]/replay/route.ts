import { NextRequest, NextResponse } from 'next/server';
import { replayDeadLetter } from '@/lib/a2a/events';
import { validateDeadLetterId } from '@/lib/a2a/events/validation';

/**
 * POST /api/a2a/events/dead-letters/:id/replay
 *
 * Replay a dead-lettered event (manual recovery after webhook failures).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const validation = validateDeadLetterId(id);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
    }

    await replayDeadLetter(id);
    return NextResponse.json({ success: true, message: 'Dead-letter event replayed' });
  } catch (err) {
    console.error('[API] POST /api/a2a/events/dead-letters/[id]/replay error:', err);
    return NextResponse.json({ error: 'Failed to replay dead-letter event' }, { status: 500 });
  }
}
