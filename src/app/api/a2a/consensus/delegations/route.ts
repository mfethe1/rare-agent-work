import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { validateRequest } from '@/lib/api-validation';
import { CreateDelegationSchema } from '@/lib/a2a/consensus/validation';
import { ConsensusEngine } from '@/lib/a2a/consensus/engine';

const engine = new ConsensusEngine();

/**
 * POST /api/a2a/consensus/delegations — Create a vote delegation.
 *
 * The authenticated agent delegates their voting power to another agent
 * within a specific council or globally.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const parsed = await validateRequest(request, CreateDelegationSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await engine.createDelegation(agent.id, parsed.data);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/consensus/delegations'), { status: 500 });
  }
}

/**
 * GET /api/a2a/consensus/delegations — List delegations.
 *
 * Query param: agent_id
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const agentId = url.searchParams.get('agent_id') ?? undefined;

  try {
    const delegations = await engine.listDelegations(agent.id, { agent_id: agentId });
    return NextResponse.json({ delegations, count: delegations.length });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/consensus/delegations'), { status: 500 });
  }
}
