/**
 * GET  /api/a2a/protocol-bridge/sessions — List translation sessions
 * POST /api/a2a/protocol-bridge/sessions — Create a new translation session
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  listSessions,
  createSession,
  listSessionsSchema,
  createSessionSchema,
  BridgeError,
} from '@/lib/a2a/protocol-bridge';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const agent_id = url.searchParams.get('agent_id') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const limit = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset');

  const parsed = listSessionsSchema.safeParse({
    agent_id,
    status,
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = listSessions(parsed.data);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid session creation request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const session = createSession(parsed.data);
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    if (err instanceof BridgeError) {
      const status =
        err.code === 'ADAPTER_NOT_FOUND' ? 404
        : 400;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    throw err;
  }
}
