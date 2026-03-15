import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { validateRequest } from '@/lib/api-validation';
import { CreateCouncilSchema } from '@/lib/a2a/consensus/validation';
import { ConsensusEngine } from '@/lib/a2a/consensus/engine';

const engine = new ConsensusEngine();

/**
 * POST /api/a2a/consensus/councils — Create a new consensus council.
 *
 * The authenticated agent creates a council that can govern proposals
 * and collective decision-making among its members.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const parsed = await validateRequest(request, CreateCouncilSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await engine.createCouncil(agent.id, parsed.data);
    if (!result) {
      return NextResponse.json({ error: 'Failed to create council.' }, { status: 500 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/consensus/councils'), { status: 500 });
  }
}

/**
 * GET /api/a2a/consensus/councils — List all councils visible to the agent.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const councils = await engine.listCouncils(agent.id);
    return NextResponse.json({ councils, count: councils.length });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/consensus/councils'), { status: 500 });
  }
}
