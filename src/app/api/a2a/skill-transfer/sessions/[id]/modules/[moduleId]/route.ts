import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { advanceModuleSchema, advanceModule } from '@/lib/a2a/skill-transfer';

/**
 * POST /api/a2a/skill-transfer/sessions/:id/modules/:moduleId — Advance module progress.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; moduleId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id, moduleId } = await params;
    const body = await request.json();
    const input = advanceModuleSchema.parse(body);
    const result = advanceModule(id, moduleId, input.action, {
      score: input.score,
      feedback: input.feedback,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[skill-transfer/sessions/module-advance]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
