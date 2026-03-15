import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { EscalateSchema, escalateDispute } from '@/lib/a2a/arbitration';

/**
 * POST /api/a2a/arbitration/disputes/:id/escalate — Escalate to next phase.
 *
 * negotiation → mediation → arbitration
 * Assigns a mediator or arbitrator via reputation-weighted selection.
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
  const parsed = await validateRequest(request, EscalateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await escalateDispute(id, agent.id, parsed.data.reason);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      dispute_id: id,
      new_phase: result.new_phase,
      assigned_agent_id: result.assigned_agent_id ?? null,
      phase_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/arbitration/disputes/:id/escalate'), { status: 500 });
  }
}
