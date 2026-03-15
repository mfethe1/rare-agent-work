/**
 * POST /api/a2a/protocol-bridge/sessions/:id/message — Send a message within a translation session
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  sendSessionMessage,
  getSession,
  sessionMessageSchema,
  BridgeError,
} from '@/lib/a2a/protocol-bridge';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = sessionMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid session message', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = sendSessionMessage(id, parsed.data.sender_agent_id, parsed.data.message);
    const session = getSession(id);
    return NextResponse.json({
      translated: result.translated,
      canonical: result.canonical,
      translation: result.translation,
      session,
    });
  } catch (err) {
    if (err instanceof BridgeError) {
      const status =
        err.code === 'NOT_FOUND' ? 404
        : err.code === 'INVALID_STATE' ? 400
        : err.code === 'UNAUTHORIZED' ? 403
        : 400;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    throw err;
  }
}
