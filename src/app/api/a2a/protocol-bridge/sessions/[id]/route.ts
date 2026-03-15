/**
 * GET    /api/a2a/protocol-bridge/sessions/:id — Get session details
 * DELETE /api/a2a/protocol-bridge/sessions/:id — Close a session
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getSession,
  closeSession,
  BridgeError,
} from '@/lib/a2a/protocol-bridge';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = getSession(id);

  if (!session) {
    return NextResponse.json(
      { error: 'Session not found', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  return NextResponse.json({ session });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const session = closeSession(id);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    return NextResponse.json({ session });
  } catch (err) {
    if (err instanceof BridgeError) {
      const status =
        err.code === 'NOT_FOUND' ? 404
        : err.code === 'INVALID_STATE' ? 400
        : 400;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    throw err;
  }
}
