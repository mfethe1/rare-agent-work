import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import {
  auctionCreateSchema,
  auctionListSchema,
  createAuction,
  listAuctions,
} from '@/lib/a2a/auctions';

/**
 * POST /api/a2a/auctions — Create a new task auction.
 *
 * Holds escrow from the requester's wallet and opens bidding.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody('task.submit', rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  const parsed = await validateRequest(request, auctionCreateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await createAuction({ agent_id: agent.id, input: parsed.data });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/auctions'), { status: 500 });
  }
}

/**
 * GET /api/a2a/auctions — List auctions with optional filters.
 *
 * Supports filtering by status, capability, auction type, and trust level.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'read');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody('read', rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const url = new URL(request.url);
    const input = auctionListSchema.parse({
      status: url.searchParams.get('status') ?? undefined,
      required_capability: url.searchParams.get('required_capability') ?? undefined,
      auction_type: url.searchParams.get('auction_type') ?? undefined,
      min_trust_level: url.searchParams.get('min_trust_level') ?? undefined,
      limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined,
      offset: url.searchParams.has('offset') ? Number(url.searchParams.get('offset')) : undefined,
    });

    const result = await listAuctions(input);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/auctions'), { status: 500 });
  }
}
