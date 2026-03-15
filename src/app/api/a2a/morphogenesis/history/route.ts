/**
 * GET /api/a2a/morphogenesis/history — Query morph event history
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { getMorphHistory } from '@/lib/a2a/morphogenesis';
import type { MorphOperation, MorphEventStatus } from '@/lib/a2a/morphogenesis';
import { safeErrorBody } from '@/lib/api-errors';

export async function GET(req: NextRequest) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const operation = req.nextUrl.searchParams.get('operation') as MorphOperation | null;
    const agentId = req.nextUrl.searchParams.get('agent_id');
    const status = req.nextUrl.searchParams.get('status') as MorphEventStatus | null;
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10);

    const result = getMorphHistory({
      operation: operation ?? undefined,
      agent_id: agentId ?? undefined,
      status: status ?? undefined,
      limit,
      offset,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('[a2a/morphogenesis/history] GET error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'GET /api/a2a/morphogenesis/history'), { status: 500 });
  }
}
