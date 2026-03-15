import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { keyRevokeSchema, revokePublicKey } from '@/lib/a2a/identity';
import type { KeyRevokeResponse } from '@/lib/a2a/identity';

/**
 * POST /api/a2a/identity/keys/:id/revoke — Revoke a public key.
 *
 * Only the owning agent can revoke their key. If the primary key is
 * revoked, the newest remaining key is automatically promoted.
 */
export async function POST(
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

  const parsed = await validateRequest(request, keyRevokeSchema);
  if (!parsed.success) return parsed.response;

  const { id: keyId } = await params;

  try {
    await revokePublicKey(agent.id, keyId, parsed.data.reason);

    const response: KeyRevokeResponse = {
      key_id: keyId,
      revoked_at: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Revocation failed';
    if (message.includes('not found') || message.includes('already revoked')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/identity/keys/:id/revoke'),
      { status: 500 },
    );
  }
}
