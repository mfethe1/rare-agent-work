import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { killSwitchLiftSchema, liftKillSwitch } from '@/lib/a2a/governance';

/**
 * POST /api/a2a/governance/kill-switch/:id/lift — Lift an agent suspension.
 *
 * Re-activates the agent and records the lift reason.
 * Only partner-level agents can lift suspensions.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  if (agent.trust_level !== 'partner') {
    return NextResponse.json(
      { error: 'Only partner-level agents can lift suspensions.' },
      { status: 403 },
    );
  }

  const { id: suspensionId } = await params;

  const parsed = await validateRequest(request, killSwitchLiftSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await liftKillSwitch(agent.id, suspensionId, parsed.data);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({
      suspension_id: suspensionId,
      status: 'lifted',
      lifted_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/governance/kill-switch/:id/lift'),
      { status: 500 },
    );
  }
}
