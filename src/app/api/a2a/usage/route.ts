import { NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a';
import { getAgentUsage, rateLimitHeaders, checkRateLimit } from '@/lib/a2a/rate-limiter';

/**
 * GET /api/a2a/usage — Query your current rate limit usage and quotas.
 *
 * Returns a full breakdown of per-action usage, remaining quota,
 * and window reset times. Agents should poll this endpoint to
 * self-regulate and avoid 429 responses.
 *
 * Requires agent authentication via Bearer token.
 * This endpoint itself is rate-limited (uses context.read quota).
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Invalid or missing agent API key.' },
      { status: 401 },
    );
  }

  // Light rate limit check on the usage endpoint itself (uses context.read quota)
  const rl = await checkRateLimit(agent.id, agent.trust_level, 'context.read');
  const headers = rateLimitHeaders(rl);

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded.',
        code: 'rate_limit_exceeded',
        retry_after_seconds: rl.retry_after_seconds,
      },
      { status: 429, headers },
    );
  }

  const usage = await getAgentUsage(agent.id, agent.trust_level);

  return NextResponse.json(usage, { headers });
}
