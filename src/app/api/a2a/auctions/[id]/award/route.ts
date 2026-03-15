import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { auctionAwardSchema, awardAuction } from '@/lib/a2a/auctions';

/**
 * POST /api/a2a/auctions/:id/award — Close bidding and select a winner.
 *
 * Only the auction requester can award. If no bid_id is provided,
 * the engine automatically evaluates all bids using the auction's
 * weighted scoring criteria.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody('task.submit', rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  const parsed = await validateRequest(request, auctionAwardSchema);
  if (!parsed.success) return parsed.response;

  try {
    const { id } = await params;
    const result = await awardAuction({
      auction_id: id,
      agent_id: agent.id,
      input: parsed.data,
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/auctions/:id/award'), { status: 500 });
  }
}
