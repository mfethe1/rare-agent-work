import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { enforceRuling } from '@/lib/a2a/arbitration';

/**
 * POST /api/a2a/arbitration/disputes/:id/enforce — Execute ruling enforcement.
 *
 * Triggers automatic execution of all enforcement directives:
 * refunds, penalties, reputation adjustments, contract changes, suspensions.
 *
 * Can be called by either party or triggered automatically after appeal window.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await enforceRuling(id);

    if (!result.success) {
      return NextResponse.json({
        error: 'Some enforcement directives failed.',
        directives_executed: result.directives_executed,
        directives_failed: result.directives_failed,
        errors: result.errors,
      }, { status: 207 }); // Multi-Status
    }

    return NextResponse.json({
      dispute_id: id,
      phase: 'closed',
      directives_executed: result.directives_executed,
      directives_failed: result.directives_failed,
    });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/arbitration/disputes/:id/enforce'), { status: 500 });
  }
}
