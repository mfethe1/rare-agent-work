import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getDisputeDetail } from '@/lib/a2a/arbitration';

/**
 * GET /api/a2a/arbitration/disputes/:id — Get full dispute detail.
 *
 * Returns the dispute record with all evidence, messages, rulings,
 * and cited precedents. Only accessible to dispute parties, the
 * assigned mediator/arbitrator, or appeal panel members.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const detail = await getDisputeDetail(id);

    if (!detail) {
      return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });
    }

    // Access control: only parties, mediator, arbitrator, or appeal panel
    const allowed = new Set([
      detail.dispute.claimant_agent_id,
      detail.dispute.respondent_agent_id,
      detail.dispute.mediator_agent_id,
      detail.dispute.arbitrator_agent_id,
      ...(detail.dispute.appeal_panel_ids ?? []),
    ].filter(Boolean));

    if (!allowed.has(agent.id)) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    return NextResponse.json(detail);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/arbitration/disputes/:id'), { status: 500 });
  }
}
