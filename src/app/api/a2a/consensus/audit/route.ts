import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { ConsensusEngine } from '@/lib/a2a/consensus/engine';

const engine = new ConsensusEngine();

/**
 * GET /api/a2a/consensus/audit — Get the consensus audit log.
 *
 * Query params: council_id, proposal_id, limit
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const councilId = url.searchParams.get('council_id') ?? undefined;
  const proposalId = url.searchParams.get('proposal_id') ?? undefined;
  const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100;

  if (isNaN(limit) || limit < 1 || limit > 1000) {
    return NextResponse.json({ error: 'Invalid limit parameter. Must be between 1 and 1000.' }, { status: 400 });
  }

  try {
    const entries = await engine.getAuditLog(agent.id, {
      council_id: councilId,
      proposal_id: proposalId,
      limit,
    });
    return NextResponse.json({ entries, count: entries.length });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/consensus/audit'), { status: 500 });
  }
}
