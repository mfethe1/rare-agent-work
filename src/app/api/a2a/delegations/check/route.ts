import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { delegationCheckSchema, checkAuthorization } from '@/lib/a2a/delegation';

/**
 * POST /api/a2a/delegations/check — Check if an action is authorized.
 *
 * Validates the delegation chain and returns whether the delegate
 * can perform the specified action on behalf of the grantor.
 * Every check is audit-logged.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'read');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody('read', rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  const parsed = await validateRequest(request, delegationCheckSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await checkAuthorization(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/delegations/check'), { status: 500 });
  }
}
