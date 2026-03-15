import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getSwarmStatus } from '@/lib/a2a/swarm/engine';

/**
 * GET /api/a2a/swarms/:swarmId — Get swarm status, metrics, and agents
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ swarmId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { swarmId } = await params;
    const result = await getSwarmStatus(swarmId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/a2a/swarms/:id error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
