import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { expireStaleConflicts } from '@/lib/a2a/knowledge/consensus-engine';

/**
 * POST /api/a2a/knowledge/conflicts/expire — Expire stale conflicts.
 * Intended to be called by a cron job or platform agent.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  // Only partner-level agents can trigger maintenance operations
  if (agent.trust_level !== 'partner') {
    return NextResponse.json({ error: 'Insufficient trust level' }, { status: 403 });
  }

  try {
    const result = await expireStaleConflicts();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/knowledge/conflicts/expire'), { status: 500 });
  }
}
