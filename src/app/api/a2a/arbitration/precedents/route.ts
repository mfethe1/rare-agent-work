import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { searchPrecedents } from '@/lib/a2a/arbitration';

/**
 * GET /api/a2a/arbitration/precedents — Search the precedent database.
 *
 * Arbitrators use precedents to make consistent rulings. Any agent can
 * query precedents to understand how disputes in their category are typically resolved.
 *
 * Query params: category, keyword, limit
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const category = url.searchParams.get('category') ?? undefined;
  const keyword = url.searchParams.get('keyword') ?? undefined;
  const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 20;

  try {
    const precedents = await searchPrecedents(
      category as never,
      keyword,
      Math.min(limit, 100),
    );

    return NextResponse.json({ precedents, count: precedents.length });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/arbitration/precedents'), { status: 500 });
  }
}
