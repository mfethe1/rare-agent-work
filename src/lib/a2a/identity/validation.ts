/**
 * Zod validation schemas for A2A Cryptographic Agent Identity endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

/**
 * Validate a base64url string (RFC 4648 §5).
 * Allows alphanumeric, dash, underscore — no padding.
 */
const base64url = (maxBytes?: number) => {
  let schema = z.string().regex(
    /^[A-Za-z0-9_-]+$/,
    'Must be a valid base64url string (no padding)',
  );
  if (maxBytes) {
    // base64url encodes 3 bytes in 4 chars
    const maxChars = Math.ceil((maxBytes * 4) / 3);
    schema = schema.max(maxChars);
  }
  return schema;
};

// ──────────────────────────────────────────────
// Key Registration — POST /api/a2a/identity/keys
// ──────────────────────────────────────────────

export const keyRegisterSchema = z.object({
  /** Base64url-encoded Ed25519 public key (32 bytes → 43 chars). */
  public_key: base64url(32).min(42).max(44),
  /** Signing algorithm. */
  algorithm: z.literal('Ed25519').default('Ed25519'),
  /** Human-readable label. */
  label: trimmed(128).optional(),
  /** Set as primary key. */
  is_primary: z.boolean().optional(),
  /** Optional expiry (ISO-8601). */
  expires_at: z.string().datetime().optional(),
});

export type KeyRegisterInput = z.infer<typeof keyRegisterSchema>;

// ──────────────────────────────────────────────
// Key Revocation — POST /api/a2a/identity/keys/:id/revoke
// ──────────────────────────────────────────────

export const keyRevokeSchema = z.object({
  reason: trimmed(500).min(1, 'Revocation reason is required'),
});

export type KeyRevokeInput = z.infer<typeof keyRevokeSchema>;

// ──────────────────────────────────────────────
// Challenge Request — POST /api/a2a/identity/challenge
// ──────────────────────────────────────────────

export const challengeRequestSchema = z.object({
  /** Key ID to challenge against. Uses primary if omitted. */
  key_id: z.string().uuid().optional(),
});

export type ChallengeRequestInput = z.infer<typeof challengeRequestSchema>;

// ──────────────────────────────────────────────
// Challenge Verify — POST /api/a2a/identity/verify
// ──────────────────────────────────────────────

export const challengeVerifySchema = z.object({
  challenge_id: z.string().uuid(),
  /** Base64url-encoded Ed25519 signature over the nonce. */
  signature: base64url(64).min(1),
});

export type ChallengeVerifyInput = z.infer<typeof challengeVerifySchema>;

// ──────────────────────────────────────────────
// Sign Payload — POST /api/a2a/identity/sign
// ──────────────────────────────────────────────

export const signPayloadSchema = z.object({
  payload: z.record(z.string(), z.unknown()).refine(
    (v) => JSON.stringify(v).length <= 65536,
    { message: 'Payload must be under 64KB when serialized' },
  ),
  key_id: z.string().uuid().optional(),
});

export type SignPayloadInput = z.infer<typeof signPayloadSchema>;

// ──────────────────────────────────────────────
// Verify Envelope — POST /api/a2a/identity/verify-envelope
// ──────────────────────────────────────────────

const envelopeSignatureSchema = z.object({
  signer_agent_id: z.string().uuid(),
  key_id: z.string().uuid(),
  fingerprint: trimmed(100),
  algorithm: z.literal('Ed25519'),
  value: base64url(64).min(1),
  signed_at: z.string().datetime(),
});

export const verifyEnvelopeSchema = z.object({
  envelope: z.object({
    payload: z.record(z.string(), z.unknown()),
    signature: envelopeSignatureSchema,
  }),
});

export type VerifyEnvelopeInput = z.infer<typeof verifyEnvelopeSchema>;

// ──────────────────────────────────────────────
// Delegation Token — POST /api/a2a/identity/delegation-token
// ──────────────────────────────────────────────

export const delegationTokenSchema = z.object({
  delegate_agent_id: z.string().uuid(),
  scopes: z.array(trimmed(64).min(1)).min(1).max(20),
  resource_ids: z.array(z.string().uuid()).max(50).optional(),
  spend_limit_per_action: z.number().min(0).optional(),
  spend_limit_total: z.number().min(0).optional(),
  allow_subdelegation: z.boolean().default(false),
  max_chain_depth: z.number().int().min(0).max(10).default(2),
  /** Duration in seconds (1 minute to 30 days). */
  duration_seconds: z.number().int().min(60).max(2592000).default(3600),
  key_id: z.string().uuid().optional(),
});

export type DelegationTokenInput = z.infer<typeof delegationTokenSchema>;

// ──────────────────────────────────────────────
// Verify Delegation Token — POST /api/a2a/identity/verify-delegation
// ──────────────────────────────────────────────

export const verifyDelegationTokenSchema = z.object({
  /** Compact token string (header.claims.signature). */
  token: trimmed(10000).min(1),
});

export type VerifyDelegationTokenInput = z.infer<typeof verifyDelegationTokenSchema>;
