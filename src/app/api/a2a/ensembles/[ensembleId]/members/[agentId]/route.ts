import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { removeMember } from '@/lib/a2a/ensemble/engine';

/**
 * DELETE /api/a2a/ensembles/:ensembleId/members/:agentId — Remove a member
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ ensembleId: string; agentId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { ensembleId, agentId } = await params;
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get('reason') ?? 'Removed by coordinator';

    const result = await removeMember(agent.id, ensembleId, agentId, reason);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('DELETE /api/a2a/ensembles/:id/members/:agentId error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
