import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  requestSessionSchema,
  listSessionsSchema,
  requestSession,
  listSessions,
} from '@/lib/a2a/skill-transfer';

/**
 * GET /api/a2a/skill-transfer/sessions — List teaching sessions for the agent.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const raw: Record<string, unknown> = {};
    const role = url.searchParams.get('role');
    if (role) raw.role = role;
    const status = url.searchParams.get('status');
    if (status) raw.status = status;
    for (const key of ['limit', 'offset']) {
      const v = url.searchParams.get(key);
      if (v) raw[key] = Number(v);
    }

    const params = listSessionsSchema.parse(raw);
    const result = listSessions(agent.id, params);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[skill-transfer/sessions/list]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}

/**
 * POST /api/a2a/skill-transfer/sessions — Request a new teaching session.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = requestSessionSchema.parse(body);
    const session = requestSession(agent.id, input);
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    console.error('[skill-transfer/sessions/request]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
