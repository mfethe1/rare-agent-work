import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  proposeEvolution,
  acceptEvolution,
  listProposals,
  ProposeEvolutionSchema,
} from '@/lib/a2a/intelligence';

/**
 * POST /api/a2a/intelligence/evolve — Propose or accept a strategy evolution
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Accept an existing proposal
    if (body.action === 'accept' && body.proposalId) {
      const evolved = acceptEvolution(body.proposalId);
      if (!evolved) {
        return NextResponse.json({ error: 'Proposal not found or already processed' }, { status: 404 });
      }
      return NextResponse.json({ strategy: evolved, evolved: true }, { status: 201 });
    }

    // Propose a new evolution
    const parsed = ProposeEvolutionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const { parentStrategyId, agentId, proposedParameters, rationale, basedOnInsights } = parsed.data;
    const proposal = proposeEvolution(parentStrategyId, agentId, proposedParameters, rationale, basedOnInsights);
    if (!proposal) {
      return NextResponse.json({ error: 'Parent strategy not found' }, { status: 404 });
    }

    return NextResponse.json({ proposal }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/intelligence/evolve error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * GET /api/a2a/intelligence/evolve?agentId=...
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') ?? agent.id;
    const proposals = listProposals(agentId);
    return NextResponse.json({ proposals });
  } catch (err) {
    console.error('GET /api/a2a/intelligence/evolve error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
