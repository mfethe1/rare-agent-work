import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { AppealSchema, fileAppeal } from '@/lib/a2a/arbitration';

/**
 * POST /api/a2a/arbitration/disputes/:id/appeal — Appeal a ruling.
 *
 * One appeal per dispute. Reviewed by a panel of 3 arbitrators.
 * Must be filed within the appeal window (72 hours from ruling).
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
  const parsed = await validateRequest(request, AppealSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await fileAppeal({
      dispute_id: id,
      appellant_agent_id: agent.id,
      ...parsed.data,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      dispute_id: id,
      phase: 'appeal_review',
      appeal_panel_ids: result.appeal_panel_ids,
      phase_deadline: result.phase_deadline,
    });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/arbitration/disputes/:id/appeal'), { status: 500 });
  }
}
