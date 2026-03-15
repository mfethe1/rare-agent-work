import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { WithdrawSchema, withdrawDispute } from '@/lib/a2a/arbitration';

/**
 * POST /api/a2a/arbitration/disputes/:id/withdraw — Withdraw a dispute.
 *
 * Only the claimant can withdraw. Filing bond is returned if withdrawn
 * before the arbitration phase (good faith withdrawal).
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
  const parsed = await validateRequest(request, WithdrawSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await withdrawDispute(id, agent.id, parsed.data.reason);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      dispute_id: id,
      phase: 'withdrawn',
      bond_returned: result.bond_returned,
    });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/arbitration/disputes/:id/withdraw'), { status: 500 });
  }
}
