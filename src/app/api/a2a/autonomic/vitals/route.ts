/**
 * POST /api/a2a/autonomic/vitals — Record a vital sign measurement
 * GET  /api/a2a/autonomic/vitals?agent_id=X — Get vital sign summaries
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { recordVitalSignSchema } from '@/lib/a2a/autonomic';
import { safeErrorBody } from '@/lib/api-errors';

export async function POST(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = recordVitalSignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    // In production, this would delegate to a shared AutonomicEngine instance
    // For now, return acknowledgment with the recorded data
    const vitalSign = {
      ...parsed.data,
      timestamp: Date.now(),
      recorded: true,
    };

    return NextResponse.json(vitalSign, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/autonomic/vitals error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agentId = req.nextUrl.searchParams.get('agent_id');
    if (!agentId) {
      return NextResponse.json({ error: 'agent_id query parameter required' }, { status: 400 });
    }

    // Placeholder: in production, query the AutonomicEngine
    return NextResponse.json({
      agent_id: agentId,
      vitals: [],
      message: 'No vital signs recorded yet for this agent',
    });
  } catch (err) {
    console.error('GET /api/a2a/autonomic/vitals error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
