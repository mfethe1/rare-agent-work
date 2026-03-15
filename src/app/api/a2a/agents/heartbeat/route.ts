import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { agentHeartbeatSchema } from '@/lib/a2a/validation';
import { recordHeartbeat, computeAvailability } from '@/lib/a2a/discovery';

/**
 * POST /api/a2a/agents/heartbeat — Report agent liveness and load.
 *
 * Agents should call this endpoint periodically (recommended: every 60s)
 * to maintain "online" status. The platform uses heartbeat data to:
 *
 * 1. Derive availability (online/busy/idle/offline) for discovery.
 * 2. Inform routing decisions — prefer agents with lower load.
 * 3. Track agent health over time.
 *
 * Requires authentication — only the owning agent can send its heartbeat.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required. Provide a valid Bearer token.' },
      { status: 401 },
    );
  }

  const parsed = await validateRequest(request, agentHeartbeatSchema);
  if (!parsed.success) return parsed.response;

  try {
    const record = await recordHeartbeat(agent.id, parsed.data);
    const availability = computeAvailability(record);

    return NextResponse.json({
      agent_id: agent.id,
      availability,
      last_heartbeat_at: record.last_heartbeat_at,
      load: record.load,
      active_tasks: record.active_tasks,
      max_concurrent_tasks: record.max_concurrent_tasks,
    });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/agents/heartbeat'),
      { status: 500 },
    );
  }
}
