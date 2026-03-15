import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { acceptCollaboration, terminateCollaboration } from '@/lib/a2a/organizations/engine';
import { acceptCollaborationSchema } from '@/lib/a2a/organizations/validation';

type Params = { params: Promise<{ orgId: string; collaborationId: string }> };

/**
 * PUT /api/a2a/organizations/:orgId/collaborations/:collaborationId — Accept collaboration
 */
export async function PUT(request: Request, { params }: Params) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { collaborationId } = await params;
    const body = await request.json();
    const parsed = acceptCollaborationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await acceptCollaboration({
      collaboration_id: collaborationId,
      actor_agent_id: agent.id,
      input: parsed.data,
    });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('PUT collaborations/:id error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * DELETE /api/a2a/organizations/:orgId/collaborations/:collaborationId — Terminate
 */
export async function DELETE(request: Request, { params }: Params) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { orgId, collaborationId } = await params;
    const result = await terminateCollaboration(collaborationId, orgId, agent.id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('DELETE collaborations/:id error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
