/**
 * GET /api/a2a/adversarial-resilience/immune-response — Network health & agent resilience check
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getNetworkHealth,
  checkAgentResilience,
  agentResilienceCheckSchema,
} from '@/lib/a2a/adversarial-resilience';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get('agent_id');

    if (agentId) {
      const parsed = agentResilienceCheckSchema.safeParse({ agent_id: agentId });
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const result = checkAgentResilience(parsed.data.agent_id);
      return NextResponse.json(result);
    }

    const health = getNetworkHealth();
    return NextResponse.json({ health });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
