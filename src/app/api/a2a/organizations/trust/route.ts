import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getEffectiveTrustLevel } from '@/lib/a2a/organizations/engine';

/**
 * GET /api/a2a/organizations/trust?agent_id=... — Get effective trust level
 *
 * Returns the agent's trust level considering organization membership.
 * If the agent belongs to a verified/partner org with trust inheritance,
 * they inherit the higher trust level.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const targetAgentId = searchParams.get('agent_id') ?? agent.id;

    const result = await getEffectiveTrustLevel(targetAgentId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/a2a/organizations/trust error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
