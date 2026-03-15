import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { proposeCollaboration, listCollaborations } from '@/lib/a2a/organizations/engine';
import { proposeCollaborationSchema, listCollaborationsSchema } from '@/lib/a2a/organizations/validation';

type Params = { params: Promise<{ orgId: string }> };

/**
 * POST /api/a2a/organizations/:orgId/collaborations — Propose cross-org collaboration
 */
export async function POST(request: Request, { params }: Params) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = checkRateLimit(agent.id, agent.trust_level ?? 'untrusted', 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody(rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const { orgId } = await params;
    const body = await request.json();
    const parsed = proposeCollaborationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await proposeCollaboration({
      proposer_org_id: orgId,
      actor_agent_id: agent.id,
      input: parsed.data,
    });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/organizations/:orgId/collaborations error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * GET /api/a2a/organizations/:orgId/collaborations — List collaborations
 */
export async function GET(request: Request, { params }: Params) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { orgId } = await params;
    const { searchParams } = new URL(request.url);
    const parsed = listCollaborationsSchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      partner_org_id: searchParams.get('partner_org_id') ?? undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await listCollaborations(orgId, parsed.data);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/a2a/organizations/:orgId/collaborations error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
