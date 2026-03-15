import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { validateRequest } from '@/lib/api-validation';
import { RevokeDelegationSchema } from '@/lib/a2a/consensus/validation';
import { ConsensusEngine } from '@/lib/a2a/consensus/engine';

const engine = new ConsensusEngine();

/**
 * POST /api/a2a/consensus/delegations/:delegationId/revoke — Revoke a delegation.
 *
 * The delegating agent can revoke their delegation at any time,
 * reclaiming their voting power.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ delegationId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const { delegationId } = await params;

  const parsed = await validateRequest(request, RevokeDelegationSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await engine.revokeDelegation(agent.id, delegationId, parsed.data);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/consensus/delegations/:delegationId/revoke'),
      { status: 500 },
    );
  }
}
