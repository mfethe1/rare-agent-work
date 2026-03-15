import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getOrgDetail, updateOrg, dissolveOrg } from '@/lib/a2a/organizations/engine';
import { updateOrgSchema } from '@/lib/a2a/organizations/validation';

type Params = { params: Promise<{ orgId: string }> };

/**
 * GET /api/a2a/organizations/:orgId — Get organization detail
 */
export async function GET(request: Request, { params }: Params) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { orgId } = await params;
    const result = await getOrgDetail(orgId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/a2a/organizations/:orgId error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * PATCH /api/a2a/organizations/:orgId — Update organization
 */
export async function PATCH(request: Request, { params }: Params) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { orgId } = await params;
    const body = await request.json();
    const parsed = updateOrgSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await updateOrg({ org_id: orgId, actor_agent_id: agent.id, input: parsed.data });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('PATCH /api/a2a/organizations/:orgId error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * DELETE /api/a2a/organizations/:orgId — Dissolve organization
 */
export async function DELETE(request: Request, { params }: Params) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { orgId } = await params;
    const result = await dissolveOrg(orgId, agent.id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('DELETE /api/a2a/organizations/:orgId error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
