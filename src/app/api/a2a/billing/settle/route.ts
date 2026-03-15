import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { settleTaskSchema, settleTask } from '@/lib/a2a/billing';

/**
 * POST /api/a2a/billing/settle — Settle a completed task under a contract.
 *
 * Debits the consumer wallet and credits the provider wallet based
 * on the contract's pricing model. Enforces governance spend limits.
 * Prevents duplicate settlement via idempotency checks.
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

  const parsed = await validateRequest(request, settleTaskSchema);
  if (!parsed.success) return parsed.response;

  try {
    const settlement = await settleTask(agent.id, parsed.data);

    if (!settlement.success) {
      const statusCode = settlement.error?.includes('not found') ? 404
        : settlement.error?.includes('Insufficient') ? 402
        : settlement.error?.includes('already settled') ? 409
        : settlement.error?.includes('not a party') ? 403
        : 422;
      return NextResponse.json({ error: settlement.error }, { status: statusCode });
    }

    return NextResponse.json({ settlement });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/billing/settle'), { status: 500 });
  }
}
