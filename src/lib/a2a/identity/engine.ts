/**
 * A2A Cryptographic Agent Identity — Engine
 *
 * Database-backed identity management that bridges the pure crypto
 * primitives (crypto.ts) with the Supabase persistence layer.
 *
 * Responsibilities:
 *   - Key registration and lifecycle (register, rotate, revoke)
 *   - Challenge-response identity verification
 *   - Signed envelope creation and verification with key trust checks
 *   - Signed delegation token creation and verification
 *   - Identity proof generation for cross-platform verification
 */

import { getServiceDb } from '../auth';
import {
  computeFingerprint,
  generateNonce,
  verifySignature,
  verifyEnvelopeSignature,
  verifyDelegationToken as verifyDelegationTokenCrypto,
  parseDelegationToken,
  base64urlDecode,
} from './crypto';
import type {
  AgentPublicKey,
  IdentityChallenge,
  ChallengeVerification,
  SignedEnvelope,
  EnvelopeVerification,
  DelegationTokenClaims,
} from './types';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

/** Challenge nonces expire after 5 minutes. */
const CHALLENGE_TTL_SECONDS = 300;

/** Maximum keys an agent can register. */
const MAX_KEYS_PER_AGENT = 10;

// ──────────────────────────────────────────────
// Key Registration & Management
// ──────────────────────────────────────────────

/**
 * Register a new Ed25519 public key for an agent.
 * Validates key format, computes fingerprint, and persists.
 */
export async function registerPublicKey(
  agentId: string,
  publicKeyB64: string,
  options: {
    label?: string;
    is_primary?: boolean;
    expires_at?: string;
  } = {},
): Promise<AgentPublicKey> {
  const db = getServiceDb();
  if (!db) throw new Error('Service unavailable');

  // Validate key bytes
  const keyBytes = base64urlDecode(publicKeyB64);
  if (keyBytes.length !== 32) {
    throw new Error('Invalid Ed25519 public key: must be exactly 32 bytes');
  }

  // Check key limit
  const { count } = await db
    .from('a2a_agent_public_keys')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('is_revoked', false);

  if ((count ?? 0) >= MAX_KEYS_PER_AGENT) {
    throw new Error(`Maximum of ${MAX_KEYS_PER_AGENT} active keys per agent`);
  }

  // Check for duplicate key
  const fingerprint = await computeFingerprint(publicKeyB64);
  const { data: existing } = await db
    .from('a2a_agent_public_keys')
    .select('id')
    .eq('fingerprint', fingerprint)
    .eq('is_revoked', false)
    .maybeSingle();

  if (existing) {
    throw new Error('A key with this fingerprint is already registered');
  }

  // If this is the first key or explicitly primary, set as primary
  const isPrimary = options.is_primary ?? (count === 0);

  // If setting as primary, unset any existing primary
  if (isPrimary) {
    await db
      .from('a2a_agent_public_keys')
      .update({ is_primary: false })
      .eq('agent_id', agentId)
      .eq('is_primary', true);
  }

  const { data, error } = await db
    .from('a2a_agent_public_keys')
    .insert({
      agent_id: agentId,
      algorithm: 'Ed25519',
      public_key: publicKeyB64,
      label: options.label ?? 'default',
      fingerprint,
      is_primary: isPrimary,
      is_revoked: false,
      expires_at: options.expires_at ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Failed to register public key');
  }

  return mapRowToPublicKey(data);
}

/**
 * List an agent's public keys.
 * By default returns only active (non-revoked, non-expired) keys.
 */
export async function listPublicKeys(
  agentId: string,
  includeRevoked = false,
): Promise<AgentPublicKey[]> {
  const db = getServiceDb();
  if (!db) return [];

  let query = db
    .from('a2a_agent_public_keys')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  if (!includeRevoked) {
    query = query.eq('is_revoked', false);
  }

  const { data } = await query;
  return (data ?? []).map(mapRowToPublicKey);
}

/**
 * Get an agent's primary public key.
 */
export async function getPrimaryKey(agentId: string): Promise<AgentPublicKey | null> {
  const db = getServiceDb();
  if (!db) return null;

  const { data } = await db
    .from('a2a_agent_public_keys')
    .select('*')
    .eq('agent_id', agentId)
    .eq('is_primary', true)
    .eq('is_revoked', false)
    .maybeSingle();

  return data ? mapRowToPublicKey(data) : null;
}

/**
 * Get a specific public key by ID.
 */
export async function getPublicKey(keyId: string): Promise<AgentPublicKey | null> {
  const db = getServiceDb();
  if (!db) return null;

  const { data } = await db
    .from('a2a_agent_public_keys')
    .select('*')
    .eq('id', keyId)
    .maybeSingle();

  return data ? mapRowToPublicKey(data) : null;
}

/**
 * Find a public key by fingerprint.
 */
export async function getKeyByFingerprint(fingerprint: string): Promise<AgentPublicKey | null> {
  const db = getServiceDb();
  if (!db) return null;

  const { data } = await db
    .from('a2a_agent_public_keys')
    .select('*')
    .eq('fingerprint', fingerprint)
    .eq('is_revoked', false)
    .maybeSingle();

  return data ? mapRowToPublicKey(data) : null;
}

/**
 * Revoke a public key. The agent must own the key.
 */
export async function revokePublicKey(
  agentId: string,
  keyId: string,
  reason: string,
): Promise<void> {
  const db = getServiceDb();
  if (!db) throw new Error('Service unavailable');

  const { data, error } = await db
    .from('a2a_agent_public_keys')
    .update({
      is_revoked: true,
      revoked_at: new Date().toISOString(),
      revocation_reason: reason,
    })
    .eq('id', keyId)
    .eq('agent_id', agentId)
    .eq('is_revoked', false)
    .select('id, is_primary')
    .maybeSingle();

  if (error || !data) {
    throw new Error('Key not found or already revoked');
  }

  // If we revoked the primary key, promote the newest remaining key
  if (data.is_primary) {
    const { data: nextKey } = await db
      .from('a2a_agent_public_keys')
      .select('id')
      .eq('agent_id', agentId)
      .eq('is_revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (nextKey) {
      await db
        .from('a2a_agent_public_keys')
        .update({ is_primary: true })
        .eq('id', nextKey.id);
    }
  }
}

// ──────────────────────────────────────────────
// Challenge-Response Verification
// ──────────────────────────────────────────────

/**
 * Issue a challenge to an agent. The agent must sign the nonce with
 * the specified key (or their primary key) to prove identity.
 */
export async function issueChallenge(
  agentId: string,
  keyId?: string,
): Promise<IdentityChallenge> {
  const db = getServiceDb();
  if (!db) throw new Error('Service unavailable');

  // Resolve key
  let targetKeyId = keyId;
  if (!targetKeyId) {
    const primary = await getPrimaryKey(agentId);
    if (!primary) throw new Error('Agent has no registered public keys');
    targetKeyId = primary.id;
  } else {
    // Verify the key belongs to the agent
    const key = await getPublicKey(targetKeyId);
    if (!key || key.agent_id !== agentId || key.is_revoked) {
      throw new Error('Key not found or not owned by agent');
    }
  }

  const nonce = generateNonce();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000).toISOString();

  const { data, error } = await db
    .from('a2a_identity_challenges')
    .insert({
      agent_id: agentId,
      key_id: targetKeyId,
      nonce,
      expires_at: expiresAt,
      is_consumed: false,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Failed to create challenge');
  }

  return {
    id: data.id,
    agent_id: data.agent_id,
    key_id: data.key_id,
    nonce: data.nonce,
    expires_at: data.expires_at,
    is_consumed: data.is_consumed,
    created_at: data.created_at,
  };
}

/**
 * Verify a challenge response. The agent signed the nonce with their private key.
 * On success, marks the challenge as consumed and updates key last_used_at.
 */
export async function verifyChallenge(
  challengeId: string,
  signatureB64: string,
): Promise<ChallengeVerification> {
  const db = getServiceDb();
  if (!db) {
    return { verified: false, agent_id: null, key_id: null, fingerprint: null, failure_reason: 'Service unavailable' };
  }

  // Fetch challenge
  const { data: challenge } = await db
    .from('a2a_identity_challenges')
    .select('*')
    .eq('id', challengeId)
    .maybeSingle();

  if (!challenge) {
    return { verified: false, agent_id: null, key_id: null, fingerprint: null, failure_reason: 'Challenge not found' };
  }

  if (challenge.is_consumed) {
    return { verified: false, agent_id: null, key_id: null, fingerprint: null, failure_reason: 'Challenge already consumed' };
  }

  if (new Date(challenge.expires_at) < new Date()) {
    return { verified: false, agent_id: null, key_id: null, fingerprint: null, failure_reason: 'Challenge expired' };
  }

  // Fetch the key
  const key = await getPublicKey(challenge.key_id);
  if (!key || key.is_revoked) {
    return { verified: false, agent_id: null, key_id: null, fingerprint: null, failure_reason: 'Key not found or revoked' };
  }

  // Check key expiry
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return { verified: false, agent_id: null, key_id: null, fingerprint: null, failure_reason: 'Key expired' };
  }

  // Verify signature over the nonce bytes
  const nonceBytes = base64urlDecode(challenge.nonce);
  const isValid = await verifySignature(nonceBytes, signatureB64, key.public_key);

  if (!isValid) {
    return { verified: false, agent_id: challenge.agent_id, key_id: key.id, fingerprint: key.fingerprint, failure_reason: 'Invalid signature' };
  }

  // Mark challenge consumed and update key last_used_at
  await Promise.all([
    db.from('a2a_identity_challenges')
      .update({ is_consumed: true })
      .eq('id', challengeId),
    db.from('a2a_agent_public_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', key.id),
  ]);

  return {
    verified: true,
    agent_id: challenge.agent_id,
    key_id: key.id,
    fingerprint: key.fingerprint,
    failure_reason: null,
  };
}

// ──────────────────────────────────────────────
// Signed Envelope Verification (with key trust)
// ──────────────────────────────────────────────

/**
 * Verify a signed envelope by looking up the signer's registered key
 * and checking both the signature and key trust status.
 */
export async function verifyEnvelope(
  envelope: SignedEnvelope,
): Promise<EnvelopeVerification> {
  const db = getServiceDb();
  if (!db) {
    return { verified: false, signer_agent_id: null, fingerprint: null, signer_trust_level: null, failure_reason: 'Service unavailable' };
  }

  const { signature } = envelope;

  // Look up the key by ID
  const key = await getPublicKey(signature.key_id);
  if (!key) {
    return { verified: false, signer_agent_id: signature.signer_agent_id, fingerprint: signature.fingerprint, signer_trust_level: null, failure_reason: 'Signing key not found' };
  }

  // Verify key ownership
  if (key.agent_id !== signature.signer_agent_id) {
    return { verified: false, signer_agent_id: signature.signer_agent_id, fingerprint: signature.fingerprint, signer_trust_level: null, failure_reason: 'Key does not belong to claimed signer' };
  }

  // Check key is active
  if (key.is_revoked) {
    return { verified: false, signer_agent_id: signature.signer_agent_id, fingerprint: key.fingerprint, signer_trust_level: null, failure_reason: 'Signing key has been revoked' };
  }
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return { verified: false, signer_agent_id: signature.signer_agent_id, fingerprint: key.fingerprint, signer_trust_level: null, failure_reason: 'Signing key has expired' };
  }

  // Verify the cryptographic signature
  const isValid = await verifyEnvelopeSignature(envelope, key.public_key);
  if (!isValid) {
    return { verified: false, signer_agent_id: signature.signer_agent_id, fingerprint: key.fingerprint, signer_trust_level: null, failure_reason: 'Invalid signature' };
  }

  // Fetch agent trust level
  const { data: agent } = await db
    .from('agent_registry')
    .select('trust_level')
    .eq('id', key.agent_id)
    .eq('is_active', true)
    .maybeSingle();

  // Update key last_used_at (fire-and-forget)
  db.from('a2a_agent_public_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', key.id)
    .then(() => {});

  return {
    verified: true,
    signer_agent_id: key.agent_id,
    fingerprint: key.fingerprint,
    signer_trust_level: agent?.trust_level ?? 'untrusted',
    failure_reason: null,
  };
}

// ──────────────────────────────────────────────
// Delegation Token Verification (with key trust)
// ──────────────────────────────────────────────

/**
 * Verify a signed delegation token by looking up the issuer's key
 * and verifying the signature, expiry, and key trust.
 */
export async function verifyDelegationTokenWithTrust(
  token: string,
): Promise<{
  verified: boolean;
  claims: DelegationTokenClaims | null;
  signer_agent_id: string | null;
  signer_trust_level: string | null;
  failure_reason: string | null;
}> {
  const db = getServiceDb();
  if (!db) {
    return { verified: false, claims: null, signer_agent_id: null, signer_trust_level: null, failure_reason: 'Service unavailable' };
  }

  // Parse to get the key ID from the header
  let parsed;
  try {
    parsed = parseDelegationToken(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Parse error';
    return { verified: false, claims: null, signer_agent_id: null, signer_trust_level: null, failure_reason: message };
  }

  // Look up the signing key
  const key = await getPublicKey(parsed.header.kid);
  if (!key || key.is_revoked) {
    return { verified: false, claims: parsed.claims, signer_agent_id: parsed.claims.iss, signer_trust_level: null, failure_reason: 'Signing key not found or revoked' };
  }

  // Verify key ownership matches claimed issuer
  if (key.agent_id !== parsed.claims.iss) {
    return { verified: false, claims: parsed.claims, signer_agent_id: parsed.claims.iss, signer_trust_level: null, failure_reason: 'Key does not belong to claimed issuer' };
  }

  // Cryptographic + temporal verification
  const result = await verifyDelegationTokenCrypto(token, key.public_key);
  if (!result.valid) {
    return { verified: false, claims: result.claims, signer_agent_id: parsed.claims.iss, signer_trust_level: null, failure_reason: result.reason };
  }

  // Fetch trust level
  const { data: agent } = await db
    .from('agent_registry')
    .select('trust_level')
    .eq('id', key.agent_id)
    .eq('is_active', true)
    .maybeSingle();

  return {
    verified: true,
    claims: result.claims,
    signer_agent_id: key.agent_id,
    signer_trust_level: agent?.trust_level ?? 'untrusted',
    failure_reason: null,
  };
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToPublicKey(row: any): AgentPublicKey {
  return {
    id: row.id,
    agent_id: row.agent_id,
    algorithm: row.algorithm,
    public_key: row.public_key,
    label: row.label,
    fingerprint: row.fingerprint,
    is_primary: row.is_primary,
    is_revoked: row.is_revoked,
    created_at: row.created_at,
    last_used_at: row.last_used_at ?? null,
    expires_at: row.expires_at ?? null,
    revoked_at: row.revoked_at ?? null,
    revocation_reason: row.revocation_reason ?? null,
  };
}
