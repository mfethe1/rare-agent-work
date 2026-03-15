/**
 * GET  /api/a2a/protocol-bridge/adapters — List registered protocol adapters
 * POST /api/a2a/protocol-bridge/adapters — Register a new adapter
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  listAdapters,
  registerAdapter,
  listAdaptersSchema,
  registerAdapterSchema,
  BridgeError,
} from '@/lib/a2a/protocol-bridge';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const protocol = url.searchParams.get('protocol') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const limit = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset');

  const parsed = listAdaptersSchema.safeParse({
    protocol,
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

  const result = listAdapters(parsed.data);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = registerAdapterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid adapter registration', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const adapter = registerAdapter(parsed.data);
    return NextResponse.json({ adapter }, { status: 201 });
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
