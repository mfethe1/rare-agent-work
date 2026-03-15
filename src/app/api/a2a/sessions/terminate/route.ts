import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { sessionTerminateSchema, terminateSession } from '@/lib/a2a/sessions';
import type { SessionTerminateResponse } from '@/lib/a2a/sessions';

/**
 * POST /api/a2a/sessions/terminate — Terminate a secure session.
 *
 * Either participant can terminate the session. After termination,
 * no more messages can be sent and the derived key material should
 * be discarded by both parties.
 *
 * This is an explicit signal to the peer that the session is over.
 * Sessions also auto-expire when their TTL is reached.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const parsed = await validateRequest(request, sessionTerminateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const session = await terminateSession(parsed.data.session_id, agent.id);

    const response: SessionTerminateResponse = {
      session_id: session.id,
      status: 'terminated',
      terminated_at: session.terminated_at!,
      message_count: session.message_count,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Termination failed';
    if (message.includes('not found') || message.includes('already terminated')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('not a participant')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/sessions/terminate'),
      { status: 500 },
    );
  }
}
