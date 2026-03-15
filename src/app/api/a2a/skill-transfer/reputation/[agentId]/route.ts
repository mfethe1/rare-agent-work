import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getTeachingReputation } from '@/lib/a2a/skill-transfer';

/**
 * GET /api/a2a/skill-transfer/reputation/:agentId — Get teaching reputation.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { agentId } = await params;
    const reputation = getTeachingReputation(agentId);
    return NextResponse.json({ reputation });
  } catch (err) {
    console.error('[skill-transfer/reputation]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
