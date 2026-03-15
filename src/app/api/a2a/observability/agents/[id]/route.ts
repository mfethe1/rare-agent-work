/**
 * GET /api/a2a/observability/agents/:id — Agent performance summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, getServiceDb } from '@/lib/a2a';
import { agentPerformanceSchema } from '@/lib/a2a/observability';
import { getAgentPerformance } from '@/lib/a2a/observability';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: targetId } = await params;
    const url = req.nextUrl.searchParams;
    const input: Record<string, unknown> = {};
    if (url.get('window_hours')) input.window_hours = Number(url.get('window_hours'));

    const parsed = agentPerformanceSchema.safeParse(input);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const db = getServiceDb();
    const perf = await getAgentPerformance(db, targetId, parsed.data.window_hours);

    if (!perf) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json(perf);
  } catch (err) {
    console.error('[a2a/observability/agents/:id] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
