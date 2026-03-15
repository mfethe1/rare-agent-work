import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { rateSessionSchema, rateSession } from '@/lib/a2a/skill-transfer';

/**
 * POST /api/a2a/skill-transfer/sessions/:id/rate — Rate a completed session.
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
    const input = rateSessionSchema.parse(body);
    const result = rateSession(id, agent.id, input);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[skill-transfer/sessions/rate]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
