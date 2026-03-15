import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { challengeVerifySchema, verifyChallenge } from '@/lib/a2a/identity';
import type { ChallengeVerifyResponse } from '@/lib/a2a/identity';

/**
 * POST /api/a2a/identity/verify — Verify a challenge response.
 *
 * The agent submits their Ed25519 signature over the challenge nonce.
 * If valid, this proves the agent controls the private key corresponding
 * to the registered public key. Challenges are one-time use.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const parsed = await validateRequest(request, challengeVerifySchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await verifyChallenge(
      parsed.data.challenge_id,
      parsed.data.signature,
    );

    const response: ChallengeVerifyResponse = {
      verified: result.verified,
      agent_id: result.agent_id,
      fingerprint: result.fingerprint,
      failure_reason: result.failure_reason,
    };

    return NextResponse.json(response, {
      status: result.verified ? 200 : 401,
    });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/identity/verify'),
      { status: 500 },
    );
  }
}
