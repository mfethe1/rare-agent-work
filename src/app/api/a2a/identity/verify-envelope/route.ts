import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { verifyEnvelopeSchema, verifyEnvelope } from '@/lib/a2a/identity';
import type { VerifyEnvelopeResponse } from '@/lib/a2a/identity';

/**
 * POST /api/a2a/identity/verify-envelope — Verify a signed envelope.
 *
 * Checks the cryptographic signature against the signer's registered
 * public key, validates key trust status, and returns the signer's
 * trust level. Any authenticated agent can verify any envelope.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const parsed = await validateRequest(request, verifyEnvelopeSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await verifyEnvelope(parsed.data.envelope);

    const response: VerifyEnvelopeResponse = {
      verified: result.verified,
      signer_agent_id: result.signer_agent_id,
      fingerprint: result.fingerprint,
      signer_trust_level: result.signer_trust_level,
      failure_reason: result.failure_reason,
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/identity/verify-envelope'),
      { status: 500 },
    );
  }
}
