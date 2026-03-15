/**
 * A2A Secure Sessions — Engine
 *
 * Database-backed session management that bridges crypto primitives
 * with the Supabase persistence layer.
 *
 * Responsibilities:
 *   - Session initiation and acceptance (ECDH handshake)
 *   - Encrypted message relay with sequence validation
 *   - Session lifecycle (active, expired, terminated)
 *   - Replay protection via monotonic sequence enforcement
 *   - Signature verification of ephemeral keys against Ed25519 identity
 */

import { getServiceDb } from '../auth';
import { verifySignature, base64urlDecode } from '../identity/crypto';
import { getPublicKey } from '../identity/engine';
import { generateSalt } from './crypto';
import type {
  SecureSession,
  EncryptedSessionMessage,
  SessionHandshake,
  SessionAcceptance,
} from './types';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

/** Default session TTL: 1 hour. */
const DEFAULT_TTL_SECONDS = 3600;

/** Maximum session TTL: 24 hours. */
const MAX_TTL_SECONDS = 86400;

/** Maximum pending messages per session before backpressure. */
const MAX_PENDING_MESSAGES = 1000;

/** Maximum concurrent active sessions per agent pair. */
const MAX_SESSIONS_PER_PAIR = 5;

// ──────────────────────────────────────────────
// Session Initiation
// ──────────────────────────────────────────────

/**
 * Initiate a secure session with another agent.
 *
 * The initiator provides their ephemeral ECDH public key signed with
 * their Ed25519 identity key. The platform verifies the signature,
 * stores the handshake, and returns a session ID + HKDF salt.
 */
export async function initiateSession(
  initiatorAgentId: string,
  handshake: SessionHandshake,
): Promise<SecureSession> {
  const db = getServiceDb();
  if (!db) throw new Error('Service unavailable');

  // 1. Verify the initiator's Ed25519 signature over their ephemeral key
  await verifyEphemeralKeySignature(
    handshake.ephemeral_public_key,
    handshake.key_signature,
    handshake.identity_key_id,
    initiatorAgentId,
  );

  // 2. Check session limits for this agent pair
  const { count } = await db
    .from('a2a_secure_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('initiator_agent_id', initiatorAgentId)
    .eq('responder_agent_id', handshake.responder_agent_id)
    .in('status', ['pending', 'active']);

  if ((count ?? 0) >= MAX_SESSIONS_PER_PAIR) {
    throw new Error(
      `Maximum of ${MAX_SESSIONS_PER_PAIR} concurrent sessions per agent pair`,
    );
  }

  // 3. Verify target agent exists and is active
  const { data: responder } = await db
    .from('agent_registry')
    .select('id')
    .eq('id', handshake.responder_agent_id)
    .eq('is_active', true)
    .maybeSingle();

  if (!responder) {
    throw new Error('Responder agent not found or inactive');
  }

  // 4. Generate HKDF salt and compute expiry
  const hkdfSalt = generateSalt();
  const ttl = Math.min(handshake.ttl_seconds ?? DEFAULT_TTL_SECONDS, MAX_TTL_SECONDS);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  // 5. Create the session record
  const { data, error } = await db
    .from('a2a_secure_sessions')
    .insert({
      initiator_agent_id: initiatorAgentId,
      responder_agent_id: handshake.responder_agent_id,
      status: 'pending',
      initiator_ephemeral_public_key: handshake.ephemeral_public_key,
      responder_ephemeral_public_key: null,
      initiator_key_signature: handshake.key_signature,
      responder_key_signature: null,
      initiator_identity_key_id: handshake.identity_key_id,
      responder_identity_key_id: null,
      hkdf_salt: hkdfSalt,
      initiator_sequence: 0,
      responder_sequence: 0,
      message_count: 0,
      expires_at: expiresAt,
      last_active_at: new Date().toISOString(),
      terminated_at: null,
      terminated_by: null,
      purpose: handshake.purpose ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Failed to create session');
  }

  return mapRowToSession(data);
}

// ──────────────────────────────────────────────
// Session Acceptance
// ──────────────────────────────────────────────

/**
 * Accept a pending session. The responder provides their ephemeral
 * ECDH public key signed with their Ed25519 identity key.
 *
 * After acceptance, both parties can derive the shared session key
 * and begin encrypted communication.
 */
export async function acceptSession(
  sessionId: string,
  responderAgentId: string,
  acceptance: SessionAcceptance,
): Promise<SecureSession> {
  const db = getServiceDb();
  if (!db) throw new Error('Service unavailable');

  // 1. Fetch and validate the session
  const { data: session } = await db
    .from('a2a_secure_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('responder_agent_id', responderAgentId)
    .eq('status', 'pending')
    .maybeSingle();

  if (!session) {
    throw new Error('Session not found, not pending, or not addressed to this agent');
  }

  // Check expiry
  if (new Date(session.expires_at) < new Date()) {
    await db
      .from('a2a_secure_sessions')
      .update({ status: 'expired' })
      .eq('id', sessionId);
    throw new Error('Session has expired');
  }

  // 2. Verify the responder's signature over their ephemeral key
  await verifyEphemeralKeySignature(
    acceptance.ephemeral_public_key,
    acceptance.key_signature,
    acceptance.identity_key_id,
    responderAgentId,
  );

  // 3. Activate the session
  const { data: updated, error } = await db
    .from('a2a_secure_sessions')
    .update({
      status: 'active',
      responder_ephemeral_public_key: acceptance.ephemeral_public_key,
      responder_key_signature: acceptance.key_signature,
      responder_identity_key_id: acceptance.identity_key_id,
      last_active_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('status', 'pending') // CAS — prevent race conditions
    .select('*')
    .single();

  if (error || !updated) {
    throw new Error('Failed to accept session (may have been concurrently modified)');
  }

  return mapRowToSession(updated);
}

// ──────────────────────────────────────────────
// Encrypted Message Relay
// ──────────────────────────────────────────────

/**
 * Store an encrypted message in a session.
 *
 * Validates:
 *   - Session is active and not expired
 *   - Sender is a participant in the session
 *   - Sequence number is exactly the next expected value (replay protection)
 *   - Message backpressure limits
 *
 * The platform stores only ciphertext — it cannot read the message content.
 */
export async function storeEncryptedMessage(
  sessionId: string,
  senderAgentId: string,
  sequence: number,
  ciphertext: string,
  iv: string,
  authTag: string,
): Promise<EncryptedSessionMessage> {
  const db = getServiceDb();
  if (!db) throw new Error('Service unavailable');

  // 1. Fetch the session
  const { data: session } = await db
    .from('a2a_secure_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) throw new Error('Session not found');
  if (session.status !== 'active') throw new Error(`Session is ${session.status}, not active`);
  if (new Date(session.expires_at) < new Date()) {
    await db.from('a2a_secure_sessions').update({ status: 'expired' }).eq('id', sessionId);
    throw new Error('Session has expired');
  }

  // 2. Determine sender role and validate sequence
  const isInitiator = session.initiator_agent_id === senderAgentId;
  const isResponder = session.responder_agent_id === senderAgentId;

  if (!isInitiator && !isResponder) {
    throw new Error('Sender is not a participant in this session');
  }

  const expectedSequence = isInitiator ? session.initiator_sequence : session.responder_sequence;
  if (sequence !== expectedSequence) {
    throw new Error(
      `Invalid sequence number: expected ${expectedSequence}, got ${sequence}`,
    );
  }

  // 3. Backpressure check
  if (session.message_count >= MAX_PENDING_MESSAGES) {
    throw new Error('Session message limit reached');
  }

  // 4. Construct AAD (must match what the sender used for encryption)
  const aadString = `${sessionId}:${sequence}`;
  const aadB64 = Buffer.from(aadString).toString('base64url');

  // 5. Store the message and increment sequence atomically
  const sequenceField = isInitiator ? 'initiator_sequence' : 'responder_sequence';
  const nextSequence = expectedSequence + 1;

  // Update session sequence and message count
  const { error: updateError } = await db
    .from('a2a_secure_sessions')
    .update({
      [sequenceField]: nextSequence,
      message_count: session.message_count + 1,
      last_active_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq(sequenceField, expectedSequence); // CAS for sequence

  if (updateError) {
    throw new Error('Failed to update session sequence (concurrent modification)');
  }

  // Insert the encrypted message
  const { data: message, error: insertError } = await db
    .from('a2a_session_messages')
    .insert({
      session_id: sessionId,
      sender_agent_id: senderAgentId,
      sequence,
      ciphertext,
      iv,
      auth_tag: authTag,
      aad: aadB64,
    })
    .select('*')
    .single();

  if (insertError || !message) {
    throw new Error('Failed to store encrypted message');
  }

  return mapRowToMessage(message);
}

// ──────────────────────────────────────────────
// Session Status & Message Retrieval
// ──────────────────────────────────────────────

/**
 * Get session details and any pending messages for the requesting agent.
 */
export async function getSessionStatus(
  sessionId: string,
  agentId: string,
): Promise<{ session: SecureSession; pending_messages: EncryptedSessionMessage[] }> {
  const db = getServiceDb();
  if (!db) throw new Error('Service unavailable');

  const { data: session } = await db
    .from('a2a_secure_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) throw new Error('Session not found');

  // Verify the requesting agent is a participant
  if (session.initiator_agent_id !== agentId && session.responder_agent_id !== agentId) {
    throw new Error('Not a participant in this session');
  }

  // Check for expiry
  if (session.status === 'active' && new Date(session.expires_at) < new Date()) {
    await db.from('a2a_secure_sessions').update({ status: 'expired' }).eq('id', sessionId);
    session.status = 'expired';
  }

  // Fetch messages sent by the OTHER agent (pending for this agent to read)
  const otherAgentId = session.initiator_agent_id === agentId
    ? session.responder_agent_id
    : session.initiator_agent_id;

  const { data: messages } = await db
    .from('a2a_session_messages')
    .select('*')
    .eq('session_id', sessionId)
    .eq('sender_agent_id', otherAgentId)
    .order('sequence', { ascending: true })
    .limit(100);

  return {
    session: mapRowToSession(session),
    pending_messages: (messages ?? []).map(mapRowToMessage),
  };
}

/**
 * List sessions for an agent with optional status filter.
 */
export async function listSessions(
  agentId: string,
  status?: string,
  limit = 20,
): Promise<SecureSession[]> {
  const db = getServiceDb();
  if (!db) return [];

  let query = db
    .from('a2a_secure_sessions')
    .select('*')
    .or(`initiator_agent_id.eq.${agentId},responder_agent_id.eq.${agentId}`)
    .order('last_active_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data } = await query;
  return (data ?? []).map(mapRowToSession);
}

// ──────────────────────────────────────────────
// Session Termination
// ──────────────────────────────────────────────

/**
 * Terminate an active session. Either participant can terminate.
 * After termination, no more messages can be sent.
 */
export async function terminateSession(
  sessionId: string,
  agentId: string,
): Promise<SecureSession> {
  const db = getServiceDb();
  if (!db) throw new Error('Service unavailable');

  const { data: session } = await db
    .from('a2a_secure_sessions')
    .select('*')
    .eq('id', sessionId)
    .in('status', ['pending', 'active'])
    .maybeSingle();

  if (!session) throw new Error('Session not found or already terminated');

  // Verify the agent is a participant
  if (session.initiator_agent_id !== agentId && session.responder_agent_id !== agentId) {
    throw new Error('Not a participant in this session');
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await db
    .from('a2a_secure_sessions')
    .update({
      status: 'terminated',
      terminated_at: now,
      terminated_by: agentId,
      last_active_at: now,
    })
    .eq('id', sessionId)
    .in('status', ['pending', 'active'])
    .select('*')
    .single();

  if (error || !updated) {
    throw new Error('Failed to terminate session');
  }

  return mapRowToSession(updated);
}

// ──────────────────────────────────────────────
// Ephemeral Key Signature Verification
// ──────────────────────────────────────────────

/**
 * Verify that an agent's Ed25519 identity key signed their ephemeral ECDH key.
 * This binds the ephemeral key to the agent's verified identity, preventing
 * man-in-the-middle attacks during key exchange.
 */
async function verifyEphemeralKeySignature(
  ephemeralPublicKeyB64: string,
  signatureB64: string,
  identityKeyId: string,
  expectedAgentId: string,
): Promise<void> {
  // Validate the ephemeral key format
  const ephemeralBytes = base64urlDecode(ephemeralPublicKeyB64);
  if (ephemeralBytes.length !== 65 || ephemeralBytes[0] !== 0x04) {
    throw new Error('Invalid ephemeral P-256 public key format');
  }

  // Fetch the Ed25519 identity key
  const identityKey = await getPublicKey(identityKeyId);
  if (!identityKey) {
    throw new Error('Identity key not found');
  }
  if (identityKey.agent_id !== expectedAgentId) {
    throw new Error('Identity key does not belong to the claimed agent');
  }
  if (identityKey.is_revoked) {
    throw new Error('Identity key has been revoked');
  }
  if (identityKey.expires_at && new Date(identityKey.expires_at) < new Date()) {
    throw new Error('Identity key has expired');
  }

  // Verify the Ed25519 signature over the raw ephemeral key bytes
  const isValid = await verifySignature(
    ephemeralBytes,
    signatureB64,
    identityKey.public_key,
  );

  if (!isValid) {
    throw new Error('Ephemeral key signature verification failed');
  }
}

// ──────────────────────────────────────────────
// Row Mappers
// ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToSession(row: any): SecureSession {
  return {
    id: row.id,
    initiator_agent_id: row.initiator_agent_id,
    responder_agent_id: row.responder_agent_id,
    status: row.status,
    initiator_ephemeral_public_key: row.initiator_ephemeral_public_key,
    responder_ephemeral_public_key: row.responder_ephemeral_public_key ?? null,
    initiator_key_signature: row.initiator_key_signature,
    responder_key_signature: row.responder_key_signature ?? null,
    initiator_identity_key_id: row.initiator_identity_key_id,
    responder_identity_key_id: row.responder_identity_key_id ?? null,
    hkdf_salt: row.hkdf_salt,
    initiator_sequence: row.initiator_sequence,
    responder_sequence: row.responder_sequence,
    message_count: row.message_count,
    expires_at: row.expires_at,
    created_at: row.created_at,
    last_active_at: row.last_active_at,
    terminated_at: row.terminated_at ?? null,
    terminated_by: row.terminated_by ?? null,
    purpose: row.purpose ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToMessage(row: any): EncryptedSessionMessage {
  return {
    id: row.id,
    session_id: row.session_id,
    sender_agent_id: row.sender_agent_id,
    sequence: row.sequence,
    ciphertext: row.ciphertext,
    iv: row.iv,
    auth_tag: row.auth_tag,
    aad: row.aad,
    created_at: row.created_at,
  };
}
