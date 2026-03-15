import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { validateRequest } from '@/lib/api-validation';
import { CreateProposalSchema } from '@/lib/a2a/consensus/validation';
import { ConsensusEngine } from '@/lib/a2a/consensus/engine';

const engine = new ConsensusEngine();

/**
 * POST /api/a2a/consensus/proposals — Create a new proposal within a council.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const parsed = await validateRequest(request, CreateProposalSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await engine.createProposal(agent.id, parsed.data);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/consensus/proposals'), { status: 500 });
  }
}

/**
 * GET /api/a2a/consensus/proposals — List proposals.
 *
 * Query params: council_id, status
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const councilId = url.searchParams.get('council_id') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;

  try {
    const proposals = await engine.listProposals(agent.id, { council_id: councilId, status });
    return NextResponse.json({ proposals, count: proposals.length });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/consensus/proposals'), { status: 500 });
  }
}
