import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getMarketplaceStats } from '@/lib/a2a/marketplace';

/**
 * GET /api/a2a/marketplace/stats — Marketplace-wide statistics.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const stats = await getMarketplaceStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error('[marketplace/stats]', err);
    return NextResponse.json(safeErrorBody(err), { status: 500 });
  }
}
