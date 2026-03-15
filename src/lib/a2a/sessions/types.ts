/**
 * A2A Secure Sessions — Types
 *
 * Defines the protocol for establishing end-to-end encrypted communication
 * channels between agents. While signed envelopes (identity/) provide
 * authenticity and integrity, secure sessions add **confidentiality** —
 * critical for agents exchanging sensitive data (financial, medical, PII).
 *
 * Protocol overview:
 *
 *   1. **Initiation**: Agent A generates an ephemeral ECDH key pair (P-256),
 *      signs its public half with its Ed25519 identity key, and sends it
 *      to Agent B via the platform.
 *
 *   2. **Acceptance**: Agent B generates its own ephemeral ECDH key pair,
 *      performs the key agreement, derives a shared AES-256-GCM key via
 *      HKDF-SHA-256, signs its ephemeral public key, and responds.
 *
 *   3. **Communication**: Both agents encrypt/decrypt messages using the
 *      derived symmetric key with unique IVs and sequence numbers for
 *      replay protection.
 *
 *   4. **Termination**: Either party can terminate the session, after which
 *      the symmetric key material is discarded.
 *
 * Security properties:
 *   - **Forward secrecy**: Ephemeral ECDH keys are discarded after derivation;
 *     compromising an agent's long-term Ed25519 key cannot decrypt past sessions.
 *   - **Mutual authentication**: Both sides sign their ephemeral keys with
 *     Ed25519 identity keys verified through the platform's trust layer.
 *   - **Replay protection**: Monotonic sequence numbers per session; the
 *     platform rejects out-of-order or duplicate sequence numbers.
 *   - **Confidentiality**: AES-256-GCM provides authenticated encryption;
 *     the platform only sees ciphertext — it cannot read session messages.
 *
 * Algorithm choices:
 *   - ECDH P-256 (NIST): Universal Web Crypto API support, well-audited.
 *   - HKDF-SHA-256: Standard key derivation (RFC 5869).
 *   - AES-256-GCM: Authenticated encryption with 96-bit IV (NIST SP 800-38D).
 */

// ──────────────────────────────────────────────
// Session Lifecycle
// ──────────────────────────────────────────────

/** Possible states of a secure session. */
export type SessionStatus =
  | 'pending'      // Initiator sent handshake, awaiting responder
  | 'active'       // Key exchange complete, messages can flow
  | 'terminated'   // Gracefully closed by either party
  | 'expired';     // TTL exceeded without renewal

/** A secure session record stored by the platform. */
export interface SecureSession {
  /** Platform-assigned session ID (UUID). */
  id: string;
  /** Agent that initiated the session. */
  initiator_agent_id: string;
  /** Agent that accepted (or will accept) the session. */
  responder_agent_id: string;
  /** Current session state. */
  status: SessionStatus;
  /** Initiator's ephemeral ECDH public key (base64url, uncompressed P-256). */
  initiator_ephemeral_public_key: string;
  /** Responder's ephemeral ECDH public key (set on acceptance). */
  responder_ephemeral_public_key: string | null;
  /** Ed25519 signature by initiator over its ephemeral key. */
  initiator_key_signature: string;
  /** Ed25519 signature by responder over its ephemeral key (set on acceptance). */
  responder_key_signature: string | null;
  /** Initiator's Ed25519 key ID used for signing. */
  initiator_identity_key_id: string;
  /** Responder's Ed25519 key ID used for signing (set on acceptance). */
  responder_identity_key_id: string | null;
  /** HKDF salt used for key derivation (base64url, 32 bytes). */
  hkdf_salt: string;
  /** Next expected sequence number from the initiator. */
  initiator_sequence: number;
  /** Next expected sequence number from the responder. */
  responder_sequence: number;
  /** Total messages exchanged in this session. */
  message_count: number;
  /** Session expiry (ISO-8601). */
  expires_at: string;
  /** When the session was created. */
  created_at: string;
  /** When the session was last active (message sent/received). */
  last_active_at: string;
  /** When the session was terminated (null if still active). */
  terminated_at: string | null;
  /** Who terminated the session (null if still active). */
  terminated_by: string | null;
  /** Optional human-readable purpose for audit. */
  purpose: string | null;
}

// ──────────────────────────────────────────────
// Encrypted Messages
// ──────────────────────────────────────────────

/** An encrypted message within a secure session. */
export interface EncryptedSessionMessage {
  /** Platform-assigned message ID (UUID). */
  id: string;
  /** Session this message belongs to. */
  session_id: string;
  /** Sending agent. */
  sender_agent_id: string;
  /** Monotonic sequence number (per sender within session). */
  sequence: number;
  /** AES-256-GCM ciphertext (base64url). */
  ciphertext: string;
  /** 96-bit IV / nonce used for this message (base64url). */
  iv: string;
  /** GCM authentication tag (base64url, 128-bit). */
  auth_tag: string;
  /** Additional authenticated data: session_id + sequence (not encrypted). */
  aad: string;
  /** When the message was sent. */
  created_at: string;
}

// ──────────────────────────────────────────────
// Session Handshake
// ──────────────────────────────────────────────

/** Data the initiator sends to establish a session. */
export interface SessionHandshake {
  /** Target agent to establish the session with. */
  responder_agent_id: string;
  /** Initiator's ephemeral ECDH P-256 public key (base64url, raw). */
  ephemeral_public_key: string;
  /** Ed25519 signature over the ephemeral key (proves initiator identity). */
  key_signature: string;
  /** Ed25519 key ID used for signing. */
  identity_key_id: string;
  /** Session duration in seconds (default: 3600, max: 86400). */
  ttl_seconds?: number;
  /** Optional purpose description for audit trails. */
  purpose?: string;
}

/** Data the responder sends to accept a session. */
export interface SessionAcceptance {
  /** Responder's ephemeral ECDH P-256 public key (base64url, raw). */
  ephemeral_public_key: string;
  /** Ed25519 signature over the ephemeral key (proves responder identity). */
  key_signature: string;
  /** Ed25519 key ID used for signing. */
  identity_key_id: string;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/sessions/establish — initiate a secure session. */
export interface SessionEstablishRequest {
  responder_agent_id: string;
  ephemeral_public_key: string;
  key_signature: string;
  identity_key_id: string;
  ttl_seconds?: number;
  purpose?: string;
}

export interface SessionEstablishResponse {
  session_id: string;
  status: 'pending';
  hkdf_salt: string;
  expires_at: string;
  created_at: string;
}

/** POST /api/a2a/sessions/establish/:id/accept — accept a pending session. */
export interface SessionAcceptRequest {
  ephemeral_public_key: string;
  key_signature: string;
  identity_key_id: string;
}

export interface SessionAcceptResponse {
  session_id: string;
  status: 'active';
  initiator_ephemeral_public_key: string;
  hkdf_salt: string;
  expires_at: string;
}

/** POST /api/a2a/sessions/send — send an encrypted message. */
export interface SessionSendRequest {
  session_id: string;
  sequence: number;
  ciphertext: string;
  iv: string;
  auth_tag: string;
}

export interface SessionSendResponse {
  message_id: string;
  session_id: string;
  sequence: number;
  created_at: string;
}

/** GET /api/a2a/sessions/status/:id — get session status and pending messages. */
export interface SessionStatusResponse {
  session: SecureSession;
  pending_messages: EncryptedSessionMessage[];
}

/** POST /api/a2a/sessions/terminate — terminate a session. */
export interface SessionTerminateRequest {
  session_id: string;
}

export interface SessionTerminateResponse {
  session_id: string;
  status: 'terminated';
  terminated_at: string;
  message_count: number;
}
