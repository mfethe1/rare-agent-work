import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { escalationResolveSchema, resolveEscalation } from '@/lib/a2a/governance';

/**
 * POST /api/a2a/governance/escalations/:id/resolve — Resolve an escalation.
 *
 * The designated escalation target (supervisor agent or human proxy)
 * approves or denies the escalated action.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const { id: escalationId } = await params;

  const parsed = await validateRequest(request, escalationResolveSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await resolveEscalation(agent.id, escalationId, parsed.data);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/governance/escalations/:id/resolve'),
      { status: 500 },
    );
  }
}
