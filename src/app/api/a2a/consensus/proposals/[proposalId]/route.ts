import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { validateRequest } from '@/lib/api-validation';
import { OpenProposalSchema, CancelProposalSchema } from '@/lib/a2a/consensus/validation';
import { ConsensusEngine } from '@/lib/a2a/consensus/engine';

const engine = new ConsensusEngine();

/**
 * GET /api/a2a/consensus/proposals/:proposalId — Get proposal details.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const { proposalId } = await params;

  try {
    const proposal = await engine.getProposal(agent.id, proposalId);
    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found.' }, { status: 404 });
    }

    return NextResponse.json(proposal);
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'GET /api/a2a/consensus/proposals/:proposalId'),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/a2a/consensus/proposals/:proposalId — Update proposal state.
 *
 * Supports action=open to open voting and action=cancel to cancel the proposal.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const { proposalId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const action = body.action as string | undefined;

  if (action === 'open') {
    const parseResult = OpenProposalSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    try {
      const result = await engine.openProposal(agent.id, proposalId, parseResult.data);

      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: result.status_code });
      }

      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(
        safeErrorBody(err, 'db', 'PATCH /api/a2a/consensus/proposals/:proposalId (open)'),
        { status: 500 },
      );
    }
  }

  if (action === 'cancel') {
    const parseResult = CancelProposalSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    try {
      const result = await engine.cancelProposal(agent.id, proposalId, parseResult.data);

      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: result.status_code });
      }

      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(
        safeErrorBody(err, 'db', 'PATCH /api/a2a/consensus/proposals/:proposalId (cancel)'),
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: 'Unknown action. Supported actions: open, cancel.' }, { status: 400 });
}
