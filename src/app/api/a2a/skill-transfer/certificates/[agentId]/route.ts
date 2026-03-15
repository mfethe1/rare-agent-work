import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getCertificates } from '@/lib/a2a/skill-transfer';

/**
 * GET /api/a2a/skill-transfer/certificates/:agentId — List agent's skill certificates.
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
    const result = getCertificates(agentId);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[skill-transfer/certificates]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
