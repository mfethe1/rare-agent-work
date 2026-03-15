/**
 * POST /api/a2a/protocol-bridge/translate — Translate a message between protocols
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  translateMessage,
  translateMessageSchema,
  BridgeError,
} from '@/lib/a2a/protocol-bridge';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = translateMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid translation request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = translateMessage(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BridgeError) {
      const status =
        err.code === 'NOT_FOUND' || err.code === 'ADAPTER_NOT_FOUND' ? 404
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
