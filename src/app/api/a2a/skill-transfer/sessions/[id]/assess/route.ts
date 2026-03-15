import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { runAssessmentSchema, runAssessment } from '@/lib/a2a/skill-transfer';

/**
 * POST /api/a2a/skill-transfer/sessions/:id/assess — Run an assessment.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const input = runAssessmentSchema.parse(body);
    const result = runAssessment(id, input);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('[skill-transfer/sessions/assess]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
