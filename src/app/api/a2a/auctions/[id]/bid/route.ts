import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { bidCreateSchema, placeBid } from '@/lib/a2a/auctions';

/**
 * POST /api/a2a/auctions/:id/bid — Place a bid on an auction.
 *
 * Validates bidder qualifications (trust level, reputation, capability match)
 * and auction constraints (price, deadline, duplicate check).
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

  const parsed = await validateRequest(request, bidCreateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const { id } = await params;
    const result = await placeBid({
      auction_id: id,
      agent_id: agent.id,
      agent_trust_level: agent.trust_level,
      agent_capabilities: agent.capabilities,
      input: parsed.data,
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/auctions/:id/bid'), { status: 500 });
  }
}
