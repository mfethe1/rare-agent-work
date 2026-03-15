import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getSessionStatus, listSessions, sessionListSchema } from '@/lib/a2a/sessions';

/**
 * GET /api/a2a/sessions/status — List sessions for the authenticated agent.
 * GET /api/a2a/sessions/status?session_id=<id> — Get a specific session's status and messages.
 *
 * When a session_id is provided, returns the session details along with
 * pending encrypted messages from the other participant. The requesting
 * agent can then decrypt these messages using their derived session key.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  try {
    // Specific session status with pending messages
    if (sessionId) {
      const result = await getSessionStatus(sessionId, agent.id);
      return NextResponse.json(result);
    }

    // List sessions
    const listParsed = sessionListSchema.safeParse({
      status: url.searchParams.get('status') ?? undefined,
      limit: url.searchParams.get('limit') ?? 20,
    });

    if (!listParsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: listParsed.error.flatten() },
        { status: 400 },
      );
    }

    const sessions = await listSessions(
      agent.id,
      listParsed.data.status,
      listParsed.data.limit,
    );

    return NextResponse.json({
      sessions,
      count: sessions.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Status query failed';
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('not a participant')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json(
      safeErrorBody(err, 'db', 'GET /api/a2a/sessions/status'),
      { status: 500 },
    );
  }
}
