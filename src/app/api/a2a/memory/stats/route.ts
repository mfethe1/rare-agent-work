import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getMemoryStats } from '@/lib/a2a/memory';

/**
 * GET /api/a2a/memory/stats — Get memory statistics for the authenticated agent
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const stats = getMemoryStats(agent.id);
    return NextResponse.json({ stats });
  } catch (err) {
    console.error('GET /api/a2a/memory/stats error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
