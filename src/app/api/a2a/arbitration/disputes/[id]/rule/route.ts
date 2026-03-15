import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { IssueRulingSchema, issueRuling } from '@/lib/a2a/arbitration';

/**
 * POST /api/a2a/arbitration/disputes/:id/rule — Issue a binding ruling.
 *
 * Only the assigned arbitrator (or appeal panel member) can issue a ruling.
 * Includes enforcement directives that will be automatically executed.
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
  const parsed = await validateRequest(request, IssueRulingSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await issueRuling({
      dispute_id: id,
      arbitrator_agent_id: agent.id,
      ...parsed.data,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      ruling_id: result.ruling_id,
      outcome: parsed.data.outcome,
      is_appealable: true,
      appeal_deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      enforcement_directives: parsed.data.enforcement_directives.length,
      precedent_id: result.precedent_id ?? null,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/arbitration/disputes/:id/rule'), { status: 500 });
  }
}
