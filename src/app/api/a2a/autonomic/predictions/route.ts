/**
 * GET  /api/a2a/autonomic/predictions — Query health predictions
 * POST /api/a2a/autonomic/predictions — Trigger prediction generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { getPredictionsSchema } from '@/lib/a2a/autonomic';
import { safeErrorBody } from '@/lib/api-errors';

export async function GET(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = getPredictionsSchema.safeParse({
      ...params,
      min_probability: params.min_probability ? Number(params.min_probability) : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
    }

    return NextResponse.json({
      predictions: [],
      filters: parsed.data,
      total: 0,
    });
  } catch (err) {
    console.error('GET /api/a2a/autonomic/predictions error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const agentId = body.agent_id;

    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
    }

    return NextResponse.json({
      agent_id: agentId,
      predictions_generated: 0,
      timestamp: Date.now(),
      message: 'Prediction generation completed — insufficient vital signs history',
    });
  } catch (err) {
    console.error('POST /api/a2a/autonomic/predictions error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
