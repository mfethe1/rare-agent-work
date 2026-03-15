import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getSpendSummary } from '@/lib/a2a/billing';

/**
 * GET /api/a2a/billing/spend — Get the agent's spend summary.
 *
 * Returns daily spend, period spend, available balance, and whether
 * the agent has exceeded governance spend limits. Used by agents
 * and governance UIs to monitor economic activity.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const currency = url.searchParams.get('currency') ?? 'credits';

  try {
    const spend = await getSpendSummary(agent.id, currency);
    if (!spend) {
      return NextResponse.json({ error: 'Failed to compute spend summary.' }, { status: 500 });
    }

    return NextResponse.json({ spend });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/billing/spend'), { status: 500 });
  }
}
