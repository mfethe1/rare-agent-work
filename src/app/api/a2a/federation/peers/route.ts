import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  peerCreateSchema,
  peerListSchema,
  registerPeer,
  listPeers,
} from '@/lib/a2a/federation';

/**
 * POST /api/a2a/federation/peers — Register a new federation peer.
 * Only partner-level agents can manage federation.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }
  if (agent.trust_level !== 'partner') {
    return NextResponse.json({ error: 'Federation management requires partner trust level.' }, { status: 403 });
  }

  const parsed = await validateRequest(request, peerCreateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await registerPeer(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/federation/peers'), { status: 500 });
  }
}

/**
 * GET /api/a2a/federation/peers — List federation peers.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const input = peerListSchema.parse({
      status: url.searchParams.get('status') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
      offset: url.searchParams.get('offset') ?? undefined,
    });
    const peers = await listPeers(input);
    return NextResponse.json({ peers });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/federation/peers'), { status: 500 });
  }
}
