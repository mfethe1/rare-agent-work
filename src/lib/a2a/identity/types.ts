/**
 * A2A Cryptographic Agent Identity — Types
 *
 * Provides the trust foundation for the entire A2A ecosystem. Instead of
 * relying solely on shared-secret API keys, agents register Ed25519 public
 * keys and prove identity through challenge-response protocols. This enables:
 *
 *   - **Peer-to-peer verification**: Agents verify each other without the
 *     platform as intermediary — critical for 2028 decentralized agent meshes.
 *
 *   - **Signed messages & tasks**: Every task, delegation, or contract can
 *     carry a cryptographic signature the recipient independently verifies.
 *
 *   - **Verifiable delegation chains**: Delegation tokens are signed by the
 *     grantor's key, so any agent in the chain can prove authorization
 *     without querying the platform database.
 *
 *   - **Non-repudiation**: Signed actions create an immutable audit trail
 *     where agents cannot deny having performed an action.
 *
 * Algorithm: Ed25519 (RFC 8032) — fast, small keys (32 bytes), deterministic
 * signatures, and resistant to timing side-channels.
 */

// ──────────────────────────────────────────────
// Key Management
// ──────────────────────────────────────────────

/** Supported signing algorithms. Ed25519 is the default and recommended. */
export type SigningAlgorithm = 'Ed25519';

/** An agent's registered public key with metadata. */
export interface AgentPublicKey {
  /** Platform-assigned key ID (UUID). */
  id: string;
  /** Agent that owns this key. */
  agent_id: string;
  /** Signing algorithm. */
  algorithm: SigningAlgorithm;
  /** Base64url-encoded public key bytes. */
  public_key: string;
  /** Optional human-readable label (e.g., "production-2028", "backup"). */
  label: string;
  /** SHA-256 fingerprint of the public key for quick identification. */
  fingerprint: string;
  /** Whether this is the agent's primary signing key. */
  is_primary: boolean;
  /** Whether this key has been revoked. */
  is_revoked: boolean;
  /** When the key was registered. */
  created_at: string;
  /** When the key was last used to sign or verify. */
  last_used_at: string | null;
  /** When the key expires (null = no expiry). */
  expires_at: string | null;
  /** When the key was revoked (null = not revoked). */
  revoked_at: string | null;
  /** Reason for revocation. */
  revocation_reason: string | null;
}

// ──────────────────────────────────────────────
// Challenge-Response Authentication
// ──────────────────────────────────────────────

/**
 * A time-limited challenge the platform issues to an agent.
 * The agent must sign the challenge nonce with their private key
 * to prove they control the corresponding public key.
 */
export interface IdentityChallenge {
  /** Platform-assigned challenge ID (UUID). */
  id: string;
  /** Agent being challenged. */
  agent_id: string;
  /** Key ID the agent must sign with. */
  key_id: string;
  /** Random nonce the agent must sign (base64url). */
  nonce: string;
  /** ISO-8601 deadline — challenge expires after this time. */
  expires_at: string;
  /** Whether this challenge has been consumed. */
  is_consumed: boolean;
  created_at: string;
}

/** Result of verifying a challenge response. */
export interface ChallengeVerification {
  /** Whether the signature is valid. */
  verified: boolean;
  /** Agent ID (if verified). */
  agent_id: string | null;
  /** Key ID used (if verified). */
  key_id: string | null;
  /** Key fingerprint (if verified). */
  fingerprint: string | null;
  /** Reason for failure (if not verified). */
  failure_reason: string | null;
}

// ──────────────────────────────────────────────
// Signed Envelopes
// ──────────────────────────────────────────────

/**
 * A cryptographically signed envelope wrapping any payload.
 * Recipients verify the signature against the signer's registered public key
 * to ensure authenticity and integrity.
 *
 * This is the universal trust primitive: tasks, delegations, contracts,
 * and channel messages can all be wrapped in a SignedEnvelope.
 */
export interface SignedEnvelope<T = unknown> {
  /** The payload being signed. */
  payload: T;
  /** Signature metadata. */
  signature: EnvelopeSignature;
}

export interface EnvelopeSignature {
  /** Signing agent's ID. */
  signer_agent_id: string;
  /** Key ID used for signing. */
  key_id: string;
  /** Key fingerprint for quick lookup. */
  fingerprint: string;
  /** Signing algorithm used. */
  algorithm: SigningAlgorithm;
  /** Base64url-encoded signature over the canonicalized payload. */
  value: string;
  /** ISO-8601 timestamp of when the signature was created. */
  signed_at: string;
}

/** Result of verifying a signed envelope. */
export interface EnvelopeVerification {
  /** Whether the signature is valid and the key is trusted. */
  verified: boolean;
  /** Signer's agent ID (if verified). */
  signer_agent_id: string | null;
  /** Key fingerprint (if verified). */
  fingerprint: string | null;
  /** Trust level of the signing agent. */
  signer_trust_level: string | null;
  /** Reason for failure (if not verified). */
  failure_reason: string | null;
}

// ──────────────────────────────────────────────
// Signed Delegation Tokens
// ──────────────────────────────────────────────

/**
 * A self-contained, cryptographically signed delegation token.
 * Unlike database-backed delegations, these can be verified offline
 * by any agent that has the grantor's public key.
 *
 * Structure mirrors a compact JWT but uses Ed25519 signatures
 * and includes the full delegation chain for sub-delegations.
 */
export interface SignedDelegationToken {
  /** Header with algorithm and key info. */
  header: DelegationTokenHeader;
  /** Delegation claims. */
  claims: DelegationTokenClaims;
  /** Base64url-encoded Ed25519 signature over header + claims. */
  signature: string;
}

export interface DelegationTokenHeader {
  /** Always 'Ed25519'. */
  alg: SigningAlgorithm;
  /** Key ID of the signing key. */
  kid: string;
  /** Token type identifier. */
  typ: 'a2a-delegation+ed25519';
}

export interface DelegationTokenClaims {
  /** Unique token ID. */
  jti: string;
  /** Issuer (grantor agent ID). */
  iss: string;
  /** Subject (delegate agent ID). */
  sub: string;
  /** Issued at (Unix timestamp). */
  iat: number;
  /** Expiration (Unix timestamp). */
  exp: number;
  /** Not before (Unix timestamp). */
  nbf: number;
  /** Delegated action scopes. */
  scopes: string[];
  /** Optional resource ID restrictions. */
  resource_ids?: string[];
  /** Spend limits. */
  spend_limit_per_action?: number;
  spend_limit_total?: number;
  /** Whether sub-delegation is allowed. */
  allow_subdelegation: boolean;
  /** Current chain depth. */
  chain_depth: number;
  /** Max allowed chain depth. */
  max_chain_depth: number;
  /** Parent token ID (for sub-delegations). */
  parent_token_id?: string;
  /** Full chain of grantor agent IDs from root to this delegation. */
  chain: string[];
}

// ──────────────────────────────────────────────
// Identity Proof (for cross-platform verification)
// ──────────────────────────────────────────────

/**
 * A portable identity proof an agent can present to any external system.
 * Contains the agent's identity claims signed by their key, plus the
 * platform's countersignature attesting the key is registered.
 */
export interface IdentityProof {
  /** The agent's self-asserted identity. */
  identity: {
    agent_id: string;
    agent_name: string;
    platform: 'rareagent.work';
    key_id: string;
    fingerprint: string;
    trust_level: string;
    issued_at: string;
    expires_at: string;
  };
  /** Agent's signature over the identity claims. */
  agent_signature: string;
  /** Platform's countersignature attesting key registration. */
  platform_attestation: string;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/identity/keys — register a public key. */
export interface KeyRegisterRequest {
  /** Base64url-encoded Ed25519 public key (32 bytes). */
  public_key: string;
  /** Signing algorithm (default: Ed25519). */
  algorithm?: SigningAlgorithm;
  /** Human-readable label. */
  label?: string;
  /** Set as primary key (default: true if first key). */
  is_primary?: boolean;
  /** Optional expiry (ISO-8601). */
  expires_at?: string;
}

export interface KeyRegisterResponse {
  key_id: string;
  fingerprint: string;
  is_primary: boolean;
  created_at: string;
}

/** GET /api/a2a/identity/keys — list an agent's public keys. */
export interface KeyListResponse {
  keys: AgentPublicKey[];
  count: number;
}

/** POST /api/a2a/identity/keys/:id/revoke — revoke a key. */
export interface KeyRevokeRequest {
  reason: string;
}

export interface KeyRevokeResponse {
  key_id: string;
  revoked_at: string;
}

/** POST /api/a2a/identity/challenge — request a challenge. */
export interface ChallengeRequest {
  /** Key ID to challenge against (optional — uses primary if omitted). */
  key_id?: string;
}

export interface ChallengeResponse {
  challenge_id: string;
  nonce: string;
  expires_at: string;
}

/** POST /api/a2a/identity/verify — verify a challenge response. */
export interface ChallengeVerifyRequest {
  challenge_id: string;
  /** Base64url-encoded Ed25519 signature over the nonce. */
  signature: string;
}

export interface ChallengeVerifyResponse {
  verified: boolean;
  agent_id: string | null;
  fingerprint: string | null;
  failure_reason: string | null;
}

/** POST /api/a2a/identity/sign — sign an arbitrary payload. */
export interface SignPayloadRequest {
  /** The payload to sign (will be JSON-canonicalized). */
  payload: Record<string, unknown>;
  /** Key ID to sign with (optional — uses primary). */
  key_id?: string;
}

export interface SignPayloadResponse {
  envelope: SignedEnvelope;
}

/** POST /api/a2a/identity/verify-envelope — verify a signed envelope. */
export interface VerifyEnvelopeRequest {
  envelope: SignedEnvelope;
}

export interface VerifyEnvelopeResponse {
  verified: boolean;
  signer_agent_id: string | null;
  fingerprint: string | null;
  signer_trust_level: string | null;
  failure_reason: string | null;
}

/** POST /api/a2a/identity/delegation-token — create a signed delegation token. */
export interface DelegationTokenRequest {
  delegate_agent_id: string;
  scopes: string[];
  resource_ids?: string[];
  spend_limit_per_action?: number;
  spend_limit_total?: number;
  allow_subdelegation?: boolean;
  max_chain_depth?: number;
  /** Duration in seconds (default: 3600). */
  duration_seconds?: number;
  /** Key ID to sign with (optional — uses primary). */
  key_id?: string;
}

export interface DelegationTokenResponse {
  /** Compact serialization: base64url(header).base64url(claims).base64url(signature) */
  token: string;
  /** Parsed token for inspection. */
  parsed: SignedDelegationToken;
  expires_at: string;
}

/** POST /api/a2a/identity/verify-delegation — verify a delegation token. */
export interface VerifyDelegationTokenRequest {
  /** Compact token string. */
  token: string;
}

export interface VerifyDelegationTokenResponse {
  verified: boolean;
  claims: DelegationTokenClaims | null;
  signer_agent_id: string | null;
  signer_trust_level: string | null;
  failure_reason: string | null;
}

/** GET /api/a2a/identity/keys/:agentId — get another agent's public keys. */
export interface AgentKeysResponse {
  agent_id: string;
  keys: Pick<AgentPublicKey, 'id' | 'algorithm' | 'public_key' | 'fingerprint' | 'is_primary' | 'created_at' | 'expires_at'>[];
}
