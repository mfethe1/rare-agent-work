/**
 * POST /api/a2a/protocol-bridge/detect — Detect protocol from raw request
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  detectProtocol,
  detectProtocolSchema,
  BridgeError,
} from '@/lib/a2a/protocol-bridge';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = detectProtocolSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid detection request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const detection = detectProtocol(parsed.data);
    return NextResponse.json({ detection });
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
