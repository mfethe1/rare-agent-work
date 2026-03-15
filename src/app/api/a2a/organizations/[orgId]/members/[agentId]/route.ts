import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { updateMember, removeMember } from '@/lib/a2a/organizations/engine';
import { updateMemberSchema } from '@/lib/a2a/organizations/validation';

type Params = { params: Promise<{ orgId: string; agentId: string }> };

/**
 * PATCH /api/a2a/organizations/:orgId/members/:agentId — Update member role/permissions
 */
export async function PATCH(request: Request, { params }: Params) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { orgId, agentId } = await params;
    const body = await request.json();
    const parsed = updateMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await updateMember({
      org_id: orgId,
      target_agent_id: agentId,
      actor_agent_id: agent.id,
      input: parsed.data,
    });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('PATCH /api/a2a/organizations/:orgId/members/:agentId error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * DELETE /api/a2a/organizations/:orgId/members/:agentId — Remove member
 */
export async function DELETE(request: Request, { params }: Params) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { orgId, agentId } = await params;
    const result = await removeMember(orgId, agentId, agent.id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('DELETE /api/a2a/organizations/:orgId/members/:agentId error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
