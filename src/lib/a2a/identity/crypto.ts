/**
 * A2A Cryptographic Agent Identity — Core Crypto Operations
 *
 * Pure cryptographic primitives using the Web Crypto API with Ed25519.
 * These functions are stateless and do not touch the database — they
 * operate on raw keys and bytes.
 *
 * All key material uses base64url encoding (RFC 4648 §5) for URL-safe
 * transport in JSON payloads and HTTP headers.
 */

import type {
  SigningAlgorithm,
  EnvelopeSignature,
  SignedEnvelope,
  SignedDelegationToken,
  DelegationTokenHeader,
  DelegationTokenClaims,
} from './types';

// ──────────────────────────────────────────────
// Base64url Encoding/Decoding (RFC 4648 §5)
// ──────────────────────────────────────────────

/** Encode a Uint8Array to base64url (no padding). */
export function base64urlEncode(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Decode a base64url string to Uint8Array. */
export function base64urlDecode(str: string): Uint8Array {
  // Restore standard base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  while (base64.length % 4 !== 0) base64 += '=';
  const binString = atob(base64);
  return Uint8Array.from(binString, (c) => c.charCodeAt(0));
}

/** Encode a JSON object to base64url. */
export function base64urlEncodeJson(obj: unknown): string {
  const json = JSON.stringify(obj);
  return base64urlEncode(new TextEncoder().encode(json));
}

/** Decode a base64url string to a JSON object. */
export function base64urlDecodeJson<T = unknown>(str: string): T {
  const bytes = base64urlDecode(str);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}

// ──────────────────────────────────────────────
// Ed25519 Key Operations
// ──────────────────────────────────────────────

const ED25519_ALGORITHM = 'Ed25519';
const ED25519_PUBLIC_KEY_BYTES = 32;

/**
 * Generate a new Ed25519 key pair.
 * Returns the raw public key bytes (32 bytes) base64url-encoded.
 * The private key CryptoKey is returned for immediate use — it
 * should NOT be persisted by the platform (agents hold their own keys).
 */
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: CryptoKey;
  publicKeyCryptoKey: CryptoKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    ED25519_ALGORITHM,
    true, // extractable (so we can export the public key)
    ['sign', 'verify'],
  );

  const rawPublicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyB64 = base64urlEncode(new Uint8Array(rawPublicKey));

  return {
    publicKey: publicKeyB64,
    privateKey: keyPair.privateKey,
    publicKeyCryptoKey: keyPair.publicKey,
  };
}

/**
 * Import a base64url-encoded Ed25519 public key for verification.
 */
export async function importPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  const keyBytes = base64urlDecode(publicKeyB64);
  if (keyBytes.length !== ED25519_PUBLIC_KEY_BYTES) {
    throw new Error(
      `Invalid Ed25519 public key: expected ${ED25519_PUBLIC_KEY_BYTES} bytes, got ${keyBytes.length}`,
    );
  }

  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    ED25519_ALGORITHM,
    true,
    ['verify'],
  );
}

/**
 * Compute the SHA-256 fingerprint of a public key.
 * Returns a colon-separated hex string (e.g., "a1:b2:c3:...").
 */
export async function computeFingerprint(publicKeyB64: string): Promise<string> {
  const keyBytes = base64urlDecode(publicKeyB64);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyBytes);
  const hashArray = new Uint8Array(hashBuffer);
  // Use first 16 bytes (128 bits) for a readable fingerprint
  return Array.from(hashArray.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');
}

/**
 * Validate that a string is a well-formed base64url-encoded Ed25519 public key.
 */
export function isValidPublicKey(publicKeyB64: string): boolean {
  try {
    const bytes = base64urlDecode(publicKeyB64);
    return bytes.length === ED25519_PUBLIC_KEY_BYTES;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// Signing & Verification
// ──────────────────────────────────────────────

/**
 * Sign arbitrary bytes with an Ed25519 private key.
 * Returns the signature as base64url.
 */
export async function signBytes(
  data: Uint8Array,
  privateKey: CryptoKey,
): Promise<string> {
  const signature = await crypto.subtle.sign(ED25519_ALGORITHM, privateKey, data);
  return base64urlEncode(new Uint8Array(signature));
}

/**
 * Verify an Ed25519 signature over arbitrary bytes.
 */
export async function verifySignature(
  data: Uint8Array,
  signatureB64: string,
  publicKeyB64: string,
): Promise<boolean> {
  try {
    const publicKey = await importPublicKey(publicKeyB64);
    const signature = base64urlDecode(signatureB64);
    return crypto.subtle.verify(ED25519_ALGORITHM, publicKey, signature, data);
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// JSON Canonicalization (deterministic serialization)
// ──────────────────────────────────────────────

/**
 * Produce a deterministic JSON serialization of a value.
 * Keys are sorted recursively, and the output is UTF-8 encoded.
 *
 * This ensures that the same logical payload always produces the
 * same byte sequence for signing, regardless of key insertion order.
 */
export function canonicalize(value: unknown): Uint8Array {
  const json = canonicalizeToString(value);
  return new TextEncoder().encode(json);
}

/** String version of canonicalize for inspection/debugging. */
export function canonicalizeToString(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

// ──────────────────────────────────────────────
// Signed Envelopes
// ──────────────────────────────────────────────

/**
 * Create a signed envelope wrapping a payload.
 * The payload is JSON-canonicalized before signing.
 */
export async function createSignedEnvelope<T>(
  payload: T,
  signerAgentId: string,
  keyId: string,
  fingerprint: string,
  privateKey: CryptoKey,
  algorithm: SigningAlgorithm = 'Ed25519',
): Promise<SignedEnvelope<T>> {
  const canonicalBytes = canonicalize(payload);
  const signatureValue = await signBytes(canonicalBytes, privateKey);

  const signature: EnvelopeSignature = {
    signer_agent_id: signerAgentId,
    key_id: keyId,
    fingerprint,
    algorithm,
    value: signatureValue,
    signed_at: new Date().toISOString(),
  };

  return { payload, signature };
}

/**
 * Verify a signed envelope's signature against a known public key.
 * Does NOT check key registration or trust — that's the engine's job.
 */
export async function verifyEnvelopeSignature<T>(
  envelope: SignedEnvelope<T>,
  publicKeyB64: string,
): Promise<boolean> {
  const canonicalBytes = canonicalize(envelope.payload);
  return verifySignature(canonicalBytes, envelope.signature.value, publicKeyB64);
}

// ──────────────────────────────────────────────
// Challenge Nonce Generation
// ──────────────────────────────────────────────

/** Generate a cryptographically random nonce (32 bytes, base64url). */
export function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

// ──────────────────────────────────────────────
// Signed Delegation Tokens
// ──────────────────────────────────────────────

/**
 * Create a signed delegation token (compact serialization).
 * Format: base64url(header).base64url(claims).base64url(signature)
 */
export async function createDelegationToken(
  claims: DelegationTokenClaims,
  keyId: string,
  privateKey: CryptoKey,
): Promise<{ token: string; parsed: SignedDelegationToken }> {
  const header: DelegationTokenHeader = {
    alg: 'Ed25519',
    kid: keyId,
    typ: 'a2a-delegation+ed25519',
  };

  const headerB64 = base64urlEncodeJson(header);
  const claimsB64 = base64urlEncodeJson(claims);
  const signingInput = new TextEncoder().encode(`${headerB64}.${claimsB64}`);
  const signature = await signBytes(signingInput, privateKey);

  const token = `${headerB64}.${claimsB64}.${signature}`;
  const parsed: SignedDelegationToken = { header, claims, signature };

  return { token, parsed };
}

/**
 * Parse a compact delegation token string into its components.
 * Does NOT verify the signature — call verifyDelegationToken for that.
 */
export function parseDelegationToken(token: string): SignedDelegationToken {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid delegation token: expected 3 dot-separated parts');
  }

  const header = base64urlDecodeJson<DelegationTokenHeader>(parts[0]);
  if (header.typ !== 'a2a-delegation+ed25519') {
    throw new Error(`Invalid token type: ${header.typ}`);
  }
  if (header.alg !== 'Ed25519') {
    throw new Error(`Unsupported algorithm: ${header.alg}`);
  }

  const claims = base64urlDecodeJson<DelegationTokenClaims>(parts[1]);
  const signature = parts[2];

  return { header, claims, signature };
}

/**
 * Verify a delegation token's signature against a known public key.
 * Also checks expiration and not-before claims.
 */
export async function verifyDelegationToken(
  token: string,
  publicKeyB64: string,
): Promise<{ valid: boolean; claims: DelegationTokenClaims | null; reason: string | null }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, claims: null, reason: 'Malformed token' };
    }

    const parsed = parseDelegationToken(token);
    const now = Math.floor(Date.now() / 1000);

    // Check temporal validity
    if (parsed.claims.exp <= now) {
      return { valid: false, claims: parsed.claims, reason: 'Token expired' };
    }
    if (parsed.claims.nbf > now) {
      return { valid: false, claims: parsed.claims, reason: 'Token not yet valid' };
    }

    // Verify signature
    const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const isValid = await verifySignature(signingInput, parts[2], publicKeyB64);

    if (!isValid) {
      return { valid: false, claims: parsed.claims, reason: 'Invalid signature' };
    }

    return { valid: true, claims: parsed.claims, reason: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { valid: false, claims: null, reason: message };
  }
}
