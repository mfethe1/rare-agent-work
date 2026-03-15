import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { challengeRequestSchema, issueChallenge } from '@/lib/a2a/identity';
import type { ChallengeResponse } from '@/lib/a2a/identity';

/**
 * POST /api/a2a/identity/challenge — Request an identity challenge.
 *
 * The platform issues a random nonce that the agent must sign with their
 * Ed25519 private key to prove they control the registered public key.
 * Challenge expires after 5 minutes.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const parsed = await validateRequest(request, challengeRequestSchema);
  if (!parsed.success) return parsed.response;

  try {
    const challenge = await issueChallenge(agent.id, parsed.data.key_id);

    const response: ChallengeResponse = {
      challenge_id: challenge.id,
      nonce: challenge.nonce,
      expires_at: challenge.expires_at,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Challenge creation failed';
    if (message.includes('no registered public keys') || message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/identity/challenge'),
      { status: 500 },
    );
  }
}
