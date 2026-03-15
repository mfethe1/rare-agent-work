import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { listFingerprints } from '@/lib/a2a/sandbox/engine';

/**
 * GET /api/a2a/sandbox/fingerprints — List behavioral fingerprints
 *
 * Returns behavioral fingerprints for agents, which characterize their
 * typical execution patterns and enable anomaly detection.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id') ?? undefined;
    const limit = searchParams.has('limit') ? Number(searchParams.get('limit')) : 50;

    const fingerprints = await listFingerprints(agentId, limit);
    return NextResponse.json({ fingerprints, count: fingerprints.length });
  } catch (err) {
    console.error('GET /api/a2a/sandbox/fingerprints error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
