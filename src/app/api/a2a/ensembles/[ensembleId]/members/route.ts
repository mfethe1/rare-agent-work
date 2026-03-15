import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { inviteMember, acceptInvite } from '@/lib/a2a/ensemble/engine';
import { inviteMemberSchema } from '@/lib/a2a/ensemble/validation';

/**
 * POST /api/a2a/ensembles/:ensembleId/members — Invite a member to the ensemble
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ ensembleId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = checkRateLimit(agent.id, agent.trust_level ?? 'untrusted', 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody(rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const { ensembleId } = await params;
    const body = await request.json();
    const parsed = inviteMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await inviteMember({
      requester_agent_id: agent.id,
      ensemble_id: ensembleId,
      input: parsed.data,
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/ensembles/:id/members error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * PUT /api/a2a/ensembles/:ensembleId/members — Accept an invite (authenticated agent accepts their own invite)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ ensembleId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { ensembleId } = await params;
    const result = await acceptInvite(agent.id, ensembleId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('PUT /api/a2a/ensembles/:id/members error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
