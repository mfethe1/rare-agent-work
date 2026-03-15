import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { evaporate } from '@/lib/a2a/swarm/engine';

/**
 * POST /api/a2a/swarms/:swarmId/evaporate — Trigger an evaporation cycle
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ swarmId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { swarmId } = await params;
    const result = await evaporate(swarmId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/a2a/swarms/:id/evaporate error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
