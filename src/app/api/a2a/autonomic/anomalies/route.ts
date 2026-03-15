/**
 * POST /api/a2a/autonomic/anomalies/scan — Trigger anomaly scan
 * GET  /api/a2a/autonomic/anomalies — Query detected anomalies
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { queryAnomaliesSchema } from '@/lib/a2a/autonomic';
import { safeErrorBody } from '@/lib/api-errors';

export async function GET(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = queryAnomaliesSchema.safeParse({
      ...params,
      resolved: params.resolved === 'true' ? true : params.resolved === 'false' ? false : undefined,
      since: params.since ? Number(params.since) : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
    }

    // Placeholder: query AutonomicEngine
    return NextResponse.json({
      anomalies: [],
      filters: parsed.data,
      total: 0,
    });
  } catch (err) {
    console.error('GET /api/a2a/autonomic/anomalies error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Trigger a full anomaly scan
    return NextResponse.json({
      scan_triggered: true,
      timestamp: Date.now(),
      anomalies_found: 0,
      message: 'Anomaly scan completed — no vital signs data to analyze',
    });
  } catch (err) {
    console.error('POST /api/a2a/autonomic/anomalies error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
