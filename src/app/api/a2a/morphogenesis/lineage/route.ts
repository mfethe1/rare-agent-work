/**
 * GET /api/a2a/morphogenesis/lineage?agent_id=X&max_depth=N — Get agent morphogenesis lineage
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { getMorphLineage } from '@/lib/a2a/morphogenesis';
import { safeErrorBody } from '@/lib/api-errors';

export async function GET(req: NextRequest) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agentId = req.nextUrl.searchParams.get('agent_id');
    if (!agentId) {
      return NextResponse.json({ error: 'agent_id query parameter required' }, { status: 400 });
    }

    const maxDepth = parseInt(req.nextUrl.searchParams.get('max_depth') ?? '10', 10);
    const lineage = getMorphLineage(agentId, maxDepth);

    return NextResponse.json({ lineage }, { status: 200 });
  } catch (err) {
    console.error('[a2a/morphogenesis/lineage] GET error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'GET /api/a2a/morphogenesis/lineage'), { status: 500 });
  }
}
