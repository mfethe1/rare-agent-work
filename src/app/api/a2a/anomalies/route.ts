/**
 * GET /api/a2a/anomalies — List detected anomalies
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, getServiceDb } from '@/lib/a2a';
import { anomalyListSchema } from '@/lib/a2a/observability';
import { listAnomalies } from '@/lib/a2a/observability';

export async function GET(req: NextRequest) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = req.nextUrl.searchParams;
    const input: Record<string, unknown> = {};
    if (url.get('agent_id')) input.agent_id = url.get('agent_id');
    if (url.get('type')) input.type = url.get('type');
    if (url.get('severity')) input.severity = url.get('severity');
    if (url.get('is_active')) input.is_active = url.get('is_active') === 'true';
    if (url.get('limit')) input.limit = Number(url.get('limit'));
    if (url.get('offset')) input.offset = Number(url.get('offset'));

    const parsed = anomalyListSchema.safeParse(input);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const db = getServiceDb();
    const result = await listAnomalies(db, parsed.data);

    return NextResponse.json({ anomalies: result.anomalies, count: result.count });
  } catch (err) {
    console.error('[a2a/anomalies] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
