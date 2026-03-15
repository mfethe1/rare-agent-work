/**
 * POST /api/a2a/protocol-bridge/negotiate — Start a protocol negotiation
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  startNegotiation,
  startNegotiationSchema,
  BridgeError,
} from '@/lib/a2a/protocol-bridge';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = startNegotiationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid negotiation request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const negotiation = startNegotiation(
      parsed.data.initiator_agent_id,
      parsed.data.responder_agent_id,
      parsed.data.initiator_protocols,
    );
    return NextResponse.json({ negotiation }, { status: 201 });
  } catch (err) {
    if (err instanceof BridgeError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 },
      );
    }
    throw err;
  }
}
