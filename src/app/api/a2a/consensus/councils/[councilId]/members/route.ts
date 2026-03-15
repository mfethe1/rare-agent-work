import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { validateRequest } from '@/lib/api-validation';
import { AddCouncilMemberSchema, RemoveCouncilMemberSchema } from '@/lib/a2a/consensus/validation';
import { ConsensusEngine } from '@/lib/a2a/consensus/engine';

const engine = new ConsensusEngine();

/**
 * POST /api/a2a/consensus/councils/:councilId/members — Add a member to a council.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ councilId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const { councilId } = await params;

  const parsed = await validateRequest(request, AddCouncilMemberSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await engine.addCouncilMember(agent.id, councilId, parsed.data);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/consensus/councils/:councilId/members'),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/a2a/consensus/councils/:councilId/members — Remove a member from a council.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ councilId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const { councilId } = await params;

  const parsed = await validateRequest(request, RemoveCouncilMemberSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await engine.removeCouncilMember(agent.id, councilId, parsed.data);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'DELETE /api/a2a/consensus/councils/:councilId/members'),
      { status: 500 },
    );
  }
}
