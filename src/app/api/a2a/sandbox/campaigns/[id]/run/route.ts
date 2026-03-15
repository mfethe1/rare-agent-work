import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { runCampaign } from '@/lib/a2a/sandbox/engine';

/**
 * POST /api/a2a/sandbox/campaigns/:id/run — Execute an evaluation campaign
 *
 * Runs all scenarios in the campaign, evaluates invariants, computes verdict,
 * and generates a behavioral fingerprint if enough data is available.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = checkRateLimit(agent.id, agent.trust_level ?? 'untrusted', 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody(rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const { id } = await params;
    const verdict = await runCampaign(id);

    if (!verdict) {
      return NextResponse.json(
        { error: 'Campaign not found or not in draft status.' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      campaign_id: id,
      status: verdict.passed ? 'passed' : 'failed',
      verdict,
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('POST /api/a2a/sandbox/campaigns/:id/run error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
