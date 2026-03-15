import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  sessionEstablishSchema,
  sessionAcceptSchema,
  initiateSession,
  acceptSession,
} from '@/lib/a2a/sessions';
import type { SessionEstablishResponse, SessionAcceptResponse } from '@/lib/a2a/sessions';

/**
 * POST /api/a2a/sessions/establish — Initiate a secure session.
 *
 * The initiator provides an ephemeral ECDH P-256 public key signed with
 * their Ed25519 identity key. The platform verifies the signature, creates
 * a session record, and returns a session ID + HKDF salt.
 *
 * The responder must accept the session (via the accept endpoint) before
 * encrypted messages can flow.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  // Check if this is an accept request (URL contains session ID)
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const establishIdx = pathParts.indexOf('establish');

  // If there's a path segment after "establish", it's an accept
  if (establishIdx >= 0 && pathParts.length > establishIdx + 1) {
    const sessionId = pathParts[establishIdx + 1];
    // Expect the last segment to be "accept"
    if (pathParts[pathParts.length - 1] === 'accept') {
      return handleAccept(request, agent.id, sessionId);
    }
  }

  // Otherwise, it's a new session initiation
  const parsed = await validateRequest(request, sessionEstablishSchema);
  if (!parsed.success) return parsed.response;

  try {
    if (parsed.data.responder_agent_id === agent.id) {
      return NextResponse.json(
        { error: 'Cannot establish a session with yourself' },
        { status: 400 },
      );
    }

    const session = await initiateSession(agent.id, {
      responder_agent_id: parsed.data.responder_agent_id,
      ephemeral_public_key: parsed.data.ephemeral_public_key,
      key_signature: parsed.data.key_signature,
      identity_key_id: parsed.data.identity_key_id,
      ttl_seconds: parsed.data.ttl_seconds,
      purpose: parsed.data.purpose,
    });

    const response: SessionEstablishResponse = {
      session_id: session.id,
      status: 'pending',
      hkdf_salt: session.hkdf_salt,
      expires_at: session.expires_at,
      created_at: session.created_at,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Session creation failed';
    if (message.includes('not found') || message.includes('inactive')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('Maximum') || message.includes('signature')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/sessions/establish'),
      { status: 500 },
    );
  }
}

/**
 * Handle session acceptance sub-route.
 */
async function handleAccept(request: Request, agentId: string, sessionId: string) {
  const parsed = await validateRequest(request, sessionAcceptSchema);
  if (!parsed.success) return parsed.response;

  try {
    const session = await acceptSession(sessionId, agentId, {
      ephemeral_public_key: parsed.data.ephemeral_public_key,
      key_signature: parsed.data.key_signature,
      identity_key_id: parsed.data.identity_key_id,
    });

    const response: SessionAcceptResponse = {
      session_id: session.id,
      status: 'active',
      initiator_ephemeral_public_key: session.initiator_ephemeral_public_key,
      hkdf_salt: session.hkdf_salt,
      expires_at: session.expires_at,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Session accept failed';
    if (message.includes('not found') || message.includes('not pending')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('expired')) {
      return NextResponse.json({ error: message }, { status: 410 });
    }
    if (message.includes('signature')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/sessions/establish/:id/accept'),
      { status: 500 },
    );
  }
}
