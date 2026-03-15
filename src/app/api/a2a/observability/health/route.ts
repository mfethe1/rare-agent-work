/**
 * GET /api/a2a/observability/health — System-wide health dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, getServiceDb } from '@/lib/a2a';
import { getSystemHealth } from '@/lib/a2a/observability';

export async function GET(req: NextRequest) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getServiceDb();
    const health = await getSystemHealth(db);
    return NextResponse.json(health);
  } catch (err) {
    console.error('[a2a/observability/health] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
