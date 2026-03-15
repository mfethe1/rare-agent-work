import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  verifyDelegationTokenSchema,
  verifyDelegationTokenWithTrust,
} from '@/lib/a2a/identity';
import type { VerifyDelegationTokenResponse } from '@/lib/a2a/identity';

/**
 * POST /api/a2a/identity/verify-delegation — Verify a signed delegation token.
 *
 * Parses the compact token, looks up the issuer's registered key,
 * verifies the Ed25519 signature, checks temporal validity (exp/nbf),
 * and returns the issuer's trust level.
 *
 * This enables agents to verify delegations offline — the token is
 * self-contained and doesn't require querying the delegations database.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const parsed = await validateRequest(request, verifyDelegationTokenSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await verifyDelegationTokenWithTrust(parsed.data.token);

    const response: VerifyDelegationTokenResponse = {
      verified: result.verified,
      claims: result.claims,
      signer_agent_id: result.signer_agent_id,
      signer_trust_level: result.signer_trust_level,
      failure_reason: result.failure_reason,
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/identity/verify-delegation'),
      { status: 500 },
    );
  }
}
