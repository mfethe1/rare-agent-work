import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { checkAnomaly } from '@/lib/a2a/sandbox/engine';
import { anomalyCheckSchema } from '@/lib/a2a/sandbox/validation';

/**
 * POST /api/a2a/sandbox/anomaly-check — Check live behavior against fingerprint
 *
 * Compares an agent's current execution metrics against their established
 * behavioral fingerprint to detect anomalous behavior. Returns per-metric
 * anomaly details and a recommended action (normal/monitor/throttle/quarantine).
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = checkRateLimit(agent.id, agent.trust_level ?? 'untrusted', 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody(rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const body = await request.json();
    const parsed = anomalyCheckSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await checkAnomaly(parsed.data);
    return NextResponse.json({
      agent_id: parsed.data.agent_id,
      fingerprint_id: result.fingerprint_id,
      anomaly_detected: result.anomaly_detected,
      anomalies: result.anomalies,
      recommendation: result.recommendation,
    });
  } catch (err) {
    console.error('POST /api/a2a/sandbox/anomaly-check error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
