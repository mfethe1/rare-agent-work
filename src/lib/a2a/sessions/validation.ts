/**
 * Zod validation schemas for A2A Secure Sessions endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

/**
 * Validate a base64url string (RFC 4648 §5).
 */
const base64url = (maxBytes?: number) => {
  let schema = z.string().regex(
    /^[A-Za-z0-9_-]+$/,
    'Must be a valid base64url string (no padding)',
  );
  if (maxBytes) {
    const maxChars = Math.ceil((maxBytes * 4) / 3);
    schema = schema.max(maxChars);
  }
  return schema;
};

// ──────────────────────────────────────────────
// Session Establishment — POST /api/a2a/sessions/establish
// ──────────────────────────────────────────────

export const sessionEstablishSchema = z.object({
  /** Target agent to establish session with. */
  responder_agent_id: z.string().uuid(),
  /** Ephemeral ECDH P-256 public key (65 bytes uncompressed → ~88 chars base64url). */
  ephemeral_public_key: base64url(65).min(86).max(88),
  /** Ed25519 signature over the ephemeral key. */
  key_signature: base64url(64).min(1),
  /** Ed25519 key ID used for signing. */
  identity_key_id: z.string().uuid(),
  /** Session TTL in seconds (1 minute to 24 hours). */
  ttl_seconds: z.number().int().min(60).max(86400).default(3600),
  /** Optional purpose for audit. */
  purpose: trimmed(500).optional(),
});

export type SessionEstablishInput = z.infer<typeof sessionEstablishSchema>;

// ──────────────────────────────────────────────
// Session Accept — POST /api/a2a/sessions/establish/:id/accept
// ──────────────────────────────────────────────

export const sessionAcceptSchema = z.object({
  /** Responder's ephemeral ECDH P-256 public key. */
  ephemeral_public_key: base64url(65).min(86).max(88),
  /** Ed25519 signature over the ephemeral key. */
  key_signature: base64url(64).min(1),
  /** Ed25519 key ID used for signing. */
  identity_key_id: z.string().uuid(),
});

export type SessionAcceptInput = z.infer<typeof sessionAcceptSchema>;

// ──────────────────────────────────────────────
// Send Encrypted Message — POST /api/a2a/sessions/send
// ──────────────────────────────────────────────

export const sessionSendSchema = z.object({
  /** Session to send the message in. */
  session_id: z.string().uuid(),
  /** Monotonic sequence number (must be next expected). */
  sequence: z.number().int().min(0),
  /** AES-256-GCM ciphertext (base64url, max 1MB). */
  ciphertext: base64url(1048576).min(1),
  /** 96-bit IV (base64url, 12 bytes → 16 chars). */
  iv: base64url(12).min(16).max(16),
  /** 128-bit GCM auth tag (base64url, 16 bytes → ~22 chars). */
  auth_tag: base64url(16).min(22).max(22),
});

export type SessionSendInput = z.infer<typeof sessionSendSchema>;

// ──────────────────────────────────────────────
// Terminate Session — POST /api/a2a/sessions/terminate
// ──────────────────────────────────────────────

export const sessionTerminateSchema = z.object({
  /** Session to terminate. */
  session_id: z.string().uuid(),
});

export type SessionTerminateInput = z.infer<typeof sessionTerminateSchema>;

// ──────────────────────────────────────────────
// List Sessions — GET /api/a2a/sessions/status
// ──────────────────────────────────────────────

export const sessionListSchema = z.object({
  /** Filter by status. */
  status: z.enum(['pending', 'active', 'terminated', 'expired']).optional(),
  /** Max results (1-100). */
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SessionListInput = z.infer<typeof sessionListSchema>;
