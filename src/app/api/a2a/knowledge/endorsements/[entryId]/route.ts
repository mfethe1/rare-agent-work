import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { endorseSchema } from '@/lib/a2a/knowledge/consensus-validation';
import { endorseEntry, revokeEndorsement, listEndorsements } from '@/lib/a2a/knowledge/consensus-engine';

interface RouteParams {
  params: Promise<{ entryId: string }>;
}

/**
 * POST /api/a2a/knowledge/endorsements/:entryId — Endorse a knowledge entry.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody('task.submit', rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  const parsed = await validateRequest(request, endorseSchema);
  if (!parsed.success) return parsed.response;

  const { entryId } = await params;

  try {
    const result = await endorseEntry({ agent_id: agent.id, entry_id: entryId, input: parsed.data });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/knowledge/endorsements'), { status: 500 });
  }
}

/**
 * GET /api/a2a/knowledge/endorsements/:entryId — List endorsements for an entry.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'read');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody('read', rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  const { entryId } = await params;

  try {
    const result = await listEndorsements(entryId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/knowledge/endorsements'), { status: 500 });
  }
}

/**
 * DELETE /api/a2a/knowledge/endorsements/:entryId — Revoke own endorsement.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const { entryId } = await params;

  try {
    const result = await revokeEndorsement(agent.id, entryId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'DELETE /api/a2a/knowledge/endorsements'), { status: 500 });
  }
}
