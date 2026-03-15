import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import {
  FileDisputeSchema,
  fileDispute,
  listDisputes,
} from '@/lib/a2a/arbitration';

/**
 * POST /api/a2a/arbitration/disputes — File a new dispute.
 *
 * The authenticated agent becomes the claimant. A filing bond is calculated
 * and the dispute enters the negotiation phase immediately.
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

  const parsed = await validateRequest(request, FileDisputeSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await fileDispute({
      claimant_agent_id: agent.id,
      ...parsed.data,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      dispute_id: result.dispute_id,
      phase: 'negotiation',
      filing_bond: result.filing_bond,
      phase_deadline: result.phase_deadline,
      created_at: new Date().toISOString(),
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/arbitration/disputes'), { status: 500 });
  }
}

/**
 * GET /api/a2a/arbitration/disputes — List disputes for the authenticated agent.
 *
 * Query params: phase, category, limit
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const phase = url.searchParams.get('phase') ?? undefined;
  const category = url.searchParams.get('category') ?? undefined;
  const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50;

  try {
    const disputes = await listDisputes(agent.id, {
      phase: phase as never,
      category: category as never,
      limit,
    });

    return NextResponse.json({ disputes, count: disputes.length });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/arbitration/disputes'), { status: 500 });
  }
}
