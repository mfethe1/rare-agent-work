import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { acceptSession, startSession } from '@/lib/a2a/skill-transfer';

/**
 * POST /api/a2a/skill-transfer/sessions/:id/accept — Mentor accepts & starts session.
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
    let session = acceptSession(id, agent.id);
    session = startSession(id, agent.id);
    return NextResponse.json({ session });
  } catch (err) {
    console.error('[skill-transfer/sessions/accept]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
