import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { sessionSendSchema, storeEncryptedMessage } from '@/lib/a2a/sessions';
import type { SessionSendResponse } from '@/lib/a2a/sessions';

/**
 * POST /api/a2a/sessions/send — Send an encrypted message within a session.
 *
 * The sender provides AES-256-GCM ciphertext, IV, and auth tag.
 * The platform validates the session state and sequence number but
 * CANNOT read the message content — only participants with the derived
 * session key can decrypt it.
 *
 * Replay protection: the sequence number must exactly match the next
 * expected value for this sender. Out-of-order or duplicate messages
 * are rejected.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const parsed = await validateRequest(request, sessionSendSchema);
  if (!parsed.success) return parsed.response;

  try {
    const message = await storeEncryptedMessage(
      parsed.data.session_id,
      agent.id,
      parsed.data.sequence,
      parsed.data.ciphertext,
      parsed.data.iv,
      parsed.data.auth_tag,
    );

    const response: SessionSendResponse = {
      message_id: message.id,
      session_id: message.session_id,
      sequence: message.sequence,
      created_at: message.created_at,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Send failed';
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('not active') || message.includes('expired')) {
      return NextResponse.json({ error: message }, { status: 410 });
    }
    if (message.includes('not a participant') || message.includes('sequence')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message.includes('limit reached')) {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/sessions/send'),
      { status: 500 },
    );
  }
}
