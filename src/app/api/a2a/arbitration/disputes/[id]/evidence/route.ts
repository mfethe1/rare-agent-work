import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { SubmitEvidenceSchema, submitEvidence } from '@/lib/a2a/arbitration';

/**
 * POST /api/a2a/arbitration/disputes/:id/evidence — Submit evidence.
 *
 * Both claimant and respondent can submit evidence during active phases.
 * Evidence is SHA-256 hashed for tamper detection.
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
  const parsed = await validateRequest(request, SubmitEvidenceSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await submitEvidence({
      dispute_id: id,
      submitted_by: agent.id,
      ...parsed.data,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      evidence_id: result.evidence_id,
      content_hash: result.content_hash,
      created_at: new Date().toISOString(),
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/arbitration/disputes/:id/evidence'), { status: 500 });
  }
}
