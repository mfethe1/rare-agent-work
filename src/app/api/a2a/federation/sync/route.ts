import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  capabilitySyncSchema,
  processCapabilitySync,
} from '@/lib/a2a/federation';

/**
 * POST /api/a2a/federation/sync — Process an inbound capability sync from a peer.
 *
 * Can be called by:
 * 1. Remote platforms pushing their agent manifests (authenticated via fingerprint)
 * 2. Local partner agents triggering a sync for a specific peer
 */
export async function POST(request: Request) {
  // Check for remote platform sync (via fingerprint header)
  const fingerprint = request.headers.get('x-federation-fingerprint');
  if (fingerprint) {
    // Remote platform is pushing capabilities to us
    const parsed = await validateRequest(request, capabilitySyncSchema);
    if (!parsed.success) return parsed.response;

    try {
      // Look up peer by fingerprint to get peer_id
      const { getServiceDb } = await import('@/lib/a2a/auth');
      const db = getServiceDb();
      if (!db) {
        return NextResponse.json({ error: 'Database not configured.' }, { status: 500 });
      }

      const { data: peer } = await db
        .from('federation_peers')
        .select('id')
        .eq('fingerprint', fingerprint)
        .eq('status', 'active')
        .single();

      if (!peer) {
        return NextResponse.json({ error: 'Unknown or inactive peer.' }, { status: 401 });
      }

      const result = await processCapabilitySync(peer.id, parsed.data);
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/federation/sync'), { status: 500 });
    }
  }

  // Local agent triggering sync — requires partner trust
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }
  if (agent.trust_level !== 'partner') {
    return NextResponse.json({ error: 'Federation sync requires partner trust level.' }, { status: 403 });
  }

  const parsed = await validateRequest(request, capabilitySyncSchema);
  if (!parsed.success) return parsed.response;

  try {
    const body = await request.clone().json();
    const peerId = body.peer_id;
    if (!peerId) {
      return NextResponse.json({ error: 'peer_id is required for local sync trigger.' }, { status: 400 });
    }

    const result = await processCapabilitySync(peerId, parsed.data);
    return NextResponse.json({ peer_id: peerId, result });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/federation/sync'), { status: 500 });
  }
}
