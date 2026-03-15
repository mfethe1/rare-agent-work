/**
 * POST /api/a2a/protocol-bridge/negotiate/:id/respond — Respond to a negotiation
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  respondToNegotiation,
  respondNegotiationSchema,
  BridgeError,
} from '@/lib/a2a/protocol-bridge';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = respondNegotiationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid negotiation response', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const negotiation = respondToNegotiation(id, parsed.data.responder_protocols);
    return NextResponse.json({ negotiation });
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
