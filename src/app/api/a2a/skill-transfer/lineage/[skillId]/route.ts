import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getLineage } from '@/lib/a2a/skill-transfer';

/**
 * GET /api/a2a/skill-transfer/lineage/:skillId — Get skill propagation lineage.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { skillId } = await params;
    const lineage = getLineage(skillId);
    if (!lineage) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }
    return NextResponse.json({ lineage });
  } catch (err) {
    console.error('[skill-transfer/lineage]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
