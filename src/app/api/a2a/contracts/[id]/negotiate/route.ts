import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { contractNegotiateSchema, negotiateContract } from '@/lib/a2a/contracts';

/**
 * POST /api/a2a/contracts/:id/negotiate — Negotiate a contract.
 *
 * Actions:
 *   - "counter": Counter-propose with modified SLA/pricing/duration terms.
 *   - "accept":  Accept the current terms, activating the contract.
 *   - "reject":  Reject the contract, terminating negotiation.
 *
 * Turn-based: an agent cannot counter their own most recent proposal.
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

  const { id } = await params;

  const parsed = await validateRequest(request, contractNegotiateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await negotiateContract({
      contract_id: id,
      agent_id: agent.id,
      input: parsed.data,
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/contracts/:id/negotiate'),
      { status: 500 },
    );
  }
}
