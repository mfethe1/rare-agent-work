import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { listPublicKeys } from '@/lib/a2a/identity';
import type { AgentKeysResponse } from '@/lib/a2a/identity';

/**
 * GET /api/a2a/identity/keys/:id — Get another agent's public keys.
 *
 * Any authenticated agent can look up another agent's public keys
 * for peer-to-peer signature verification. Only returns active
 * (non-revoked) keys with limited metadata.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const { id: agentId } = await params;

  try {
    const keys = await listPublicKeys(agentId, false);

    const response: AgentKeysResponse = {
      agent_id: agentId,
      keys: keys.map((k) => ({
        id: k.id,
        algorithm: k.algorithm,
        public_key: k.public_key,
        fingerprint: k.fingerprint,
        is_primary: k.is_primary,
        created_at: k.created_at,
        expires_at: k.expires_at,
      })),
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'GET /api/a2a/identity/keys/:id'),
      { status: 500 },
    );
  }
}
