import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  keyRegisterSchema,
  registerPublicKey,
  listPublicKeys,
} from '@/lib/a2a/identity';
import type { KeyRegisterResponse, KeyListResponse } from '@/lib/a2a/identity';

/**
 * GET /api/a2a/identity/keys — List the authenticated agent's public keys.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const includeRevoked = url.searchParams.get('include_revoked') === 'true';
    const keys = await listPublicKeys(agent.id, includeRevoked);

    const response: KeyListResponse = { keys, count: keys.length };
    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'GET /api/a2a/identity/keys'),
      { status: 500 },
    );
  }
}

/**
 * POST /api/a2a/identity/keys — Register a new Ed25519 public key.
 *
 * Agents generate key pairs locally and register only the public key.
 * The platform never sees or stores private keys.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const parsed = await validateRequest(request, keyRegisterSchema);
  if (!parsed.success) return parsed.response;

  try {
    const key = await registerPublicKey(agent.id, parsed.data.public_key, {
      label: parsed.data.label,
      is_primary: parsed.data.is_primary,
      expires_at: parsed.data.expires_at,
    });

    const response: KeyRegisterResponse = {
      key_id: key.id,
      fingerprint: key.fingerprint,
      is_primary: key.is_primary,
      created_at: key.created_at,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    if (message.includes('already registered') || message.includes('Maximum')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/identity/keys'),
      { status: 500 },
    );
  }
}
