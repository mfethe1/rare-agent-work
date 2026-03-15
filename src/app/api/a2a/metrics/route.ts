/**
 * POST /api/a2a/metrics — Record a metric data point
 * GET  /api/a2a/metrics — Query aggregated metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, getServiceDb } from '@/lib/a2a';
import { metricRecordSchema, metricsQuerySchema } from '@/lib/a2a/observability';
import { recordMetric, queryMetrics } from '@/lib/a2a/observability';

export async function POST(req: NextRequest) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = metricRecordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const db = getServiceDb();
    await recordMetric(db, agent.id, parsed.data.metric, parsed.data.value, parsed.data.tags);

    return NextResponse.json({ recorded: true }, { status: 201 });
  } catch (err) {
    console.error('[a2a/metrics] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = req.nextUrl.searchParams;
    const input: Record<string, unknown> = {
      metric: url.get('metric') ?? '',
      started_after: url.get('started_after') ?? '',
      started_before: url.get('started_before') ?? '',
    };
    if (url.get('agent_id')) input.agent_id = url.get('agent_id');
    if (url.get('granularity')) input.granularity = url.get('granularity');

    const parsed = metricsQuerySchema.safeParse(input);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { metric, started_after, started_before, granularity, agent_id } = parsed.data;
    const db = getServiceDb();

    const metrics = await queryMetrics(db, metric, started_after, started_before, granularity, {
      agent_id,
    });

    return NextResponse.json({
      metrics,
      granularity,
      window_start: started_after,
      window_end: started_before,
    });
  } catch (err) {
    console.error('[a2a/metrics] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
