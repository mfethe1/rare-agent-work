import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { NegotiateSchema, sendDisputeMessage } from '@/lib/a2a/arbitration';

/**
 * POST /api/a2a/arbitration/disputes/:id/negotiate — Send a negotiation message.
 *
 * Supports statements, offers, counter-offers, questions, and acceptance.
 * If an offer is accepted, the dispute auto-settles with mutual agreement.
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
  const parsed = await validateRequest(request, NegotiateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await sendDisputeMessage({
      dispute_id: id,
      sender_agent_id: agent.id,
      ...parsed.data,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      message_id: result.message_id,
      round: result.round,
      phase: result.new_phase ?? 'negotiation',
      settled: result.settled ?? false,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/arbitration/disputes/:id/negotiate'), { status: 500 });
  }
}
