import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { validateRequest } from '@/lib/api-validation';
import {
  getPeerDetail,
  suspendPeer,
  revokePeer,
  activatePeer,
  peerSuspendSchema,
} from '@/lib/a2a/federation';

/**
 * GET /api/a2a/federation/peers/:id — Get peer detail with stats.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await getPeerDetail(id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/federation/peers/:id'), { status: 500 });
  }
}

/**
 * PATCH /api/a2a/federation/peers/:id — Suspend, revoke, or activate a peer.
 * Body: { action: "suspend" | "revoke" | "activate", reason?: string }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }
  if (agent.trust_level !== 'partner') {
    return NextResponse.json({ error: 'Federation management requires partner trust level.' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action as string;

    if (action === 'suspend') {
      const parsed = peerSuspendSchema.parse(body);
      const peer = await suspendPeer(id, parsed.reason);
      return NextResponse.json({ peer });
    } else if (action === 'revoke') {
      const reason = body.reason ?? 'Manual revocation';
      const peer = await revokePeer(id, reason);
      return NextResponse.json({ peer });
    } else if (action === 'activate') {
      const peer = await activatePeer(id);
      return NextResponse.json({ peer });
    } else {
      return NextResponse.json({ error: 'Invalid action. Use: suspend, revoke, activate' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'PATCH /api/a2a/federation/peers/:id'), { status: 500 });
  }
}
