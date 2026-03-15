import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { killSwitchSchema, activateKillSwitch } from '@/lib/a2a/governance';

/**
 * POST /api/a2a/governance/kill-switch — Immediately suspend an agent.
 *
 * Deactivates the target agent, cancels all active tasks, terminates
 * all active contracts, and records an immutable suspension record.
 * Only partner-level agents can activate kill switches.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  if (agent.trust_level !== 'partner') {
    return NextResponse.json(
      { error: 'Only partner-level agents can activate kill switches.' },
      { status: 403 },
    );
  }

  const parsed = await validateRequest(request, killSwitchSchema);
  if (!parsed.success) return parsed.response;

  if (parsed.data.agent_id === agent.id) {
    return NextResponse.json({ error: 'Cannot suspend yourself.' }, { status: 422 });
  }

  try {
    const suspension = await activateKillSwitch(agent.id, parsed.data);
    if (!suspension) {
      return NextResponse.json({ error: 'Failed to activate kill switch.' }, { status: 500 });
    }

    return NextResponse.json({
      suspension_id: suspension.id,
      agent_id: suspension.agent_id,
      tasks_cancelled: suspension.tasks_cancelled,
      workflows_paused: suspension.workflows_paused,
      contracts_frozen: suspension.contracts_frozen,
      created_at: suspension.created_at,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/governance/kill-switch'), { status: 500 });
  }
}
