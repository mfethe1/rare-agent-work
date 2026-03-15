/**
 * A2A Secure Sessions — Crypto Primitives
 *
 * Pure cryptographic operations for establishing encrypted agent-to-agent
 * sessions using ECDH P-256 key agreement + HKDF-SHA-256 key derivation
 * + AES-256-GCM authenticated encryption.
 *
 * These functions are stateless — they operate on raw keys and bytes.
 * The engine (engine.ts) handles persistence and session lifecycle.
 *
 * Key exchange flow:
 *   1. Both agents generate ephemeral ECDH P-256 key pairs.
 *   2. They exchange public keys (signed with Ed25519 for authentication).
 *   3. Each agent performs ECDH to derive a shared secret.
 *   4. HKDF-SHA-256 stretches the shared secret into a 256-bit AES key.
 *   5. Messages are encrypted with AES-256-GCM using unique 96-bit IVs.
 */

import { base64urlEncode, base64urlDecode } from '../identity/crypto';

// ──────────────────────────────────────────────
// ECDH P-256 Key Operations
// ──────────────────────────────────────────────

const ECDH_ALGORITHM = { name: 'ECDH', namedCurve: 'P-256' } as const;

/**
 * Generate an ephemeral ECDH P-256 key pair for session establishment.
 * Returns the raw public key (65 bytes uncompressed) as base64url
 * and the CryptoKey private key for ECDH derivation.
 *
 * These keys MUST be ephemeral — generate fresh for every session.
 */
export async function generateEphemeralKeyPair(): Promise<{
  publicKey: string;
  privateKey: CryptoKey;
  publicKeyCryptoKey: CryptoKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    ECDH_ALGORITHM,
    true,
    ['deriveBits'],
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
 * Import a base64url-encoded ECDH P-256 public key for key agreement.
 * Expects the raw uncompressed format (65 bytes: 0x04 || x || y).
 */
export async function importEphemeralPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  const keyBytes = base64urlDecode(publicKeyB64);
  if (keyBytes.length !== 65) {
    throw new Error(
      `Invalid P-256 public key: expected 65 bytes (uncompressed), got ${keyBytes.length}`,
    );
  }
  if (keyBytes[0] !== 0x04) {
    throw new Error('Invalid P-256 public key: must be uncompressed format (0x04 prefix)');
  }

  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    ECDH_ALGORITHM,
    true,
    [],
  );
}

/**
 * Validate that a string is a well-formed base64url-encoded P-256 public key.
 */
export function isValidEphemeralPublicKey(publicKeyB64: string): boolean {
  try {
    const bytes = base64urlDecode(publicKeyB64);
    return bytes.length === 65 && bytes[0] === 0x04;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// ECDH Key Agreement + HKDF Key Derivation
// ──────────────────────────────────────────────

/**
 * Perform ECDH key agreement and derive a 256-bit AES-GCM key.
 *
 * @param ownPrivateKey   - This agent's ephemeral ECDH private key.
 * @param peerPublicKeyB64 - The peer's ephemeral public key (base64url).
 * @param salt            - HKDF salt (base64url, 32 bytes) — shared by both parties.
 * @param info            - HKDF info string for domain separation (default: 'a2a-session-v1').
 * @returns AES-256-GCM CryptoKey ready for encrypt/decrypt.
 */
export async function deriveSessionKey(
  ownPrivateKey: CryptoKey,
  peerPublicKeyB64: string,
  salt: string,
  info = 'a2a-session-v1',
): Promise<CryptoKey> {
  const peerPublicKey = await importEphemeralPublicKey(peerPublicKeyB64);

  // Step 1: ECDH to get shared secret (256 bits for P-256)
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: peerPublicKey },
    ownPrivateKey,
    256,
  );

  // Step 2: Import shared secret as HKDF base key
  const hkdfBaseKey = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey'],
  );

  // Step 3: HKDF-SHA-256 to derive AES-256-GCM key
  const saltBytes = base64urlDecode(salt);
  const infoBytes = new TextEncoder().encode(info);

  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: saltBytes, info: infoBytes },
    hkdfBaseKey,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable for security
    ['encrypt', 'decrypt'],
  );
}

/**
 * Generate a random HKDF salt (32 bytes, base64url).
 * The initiator generates this and shares it with the responder.
 */
export function generateSalt(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

// ──────────────────────────────────────────────
// AES-256-GCM Encryption / Decryption
// ──────────────────────────────────────────────

/**
 * Encrypt a plaintext message with AES-256-GCM.
 *
 * @param plaintext   - UTF-8 string to encrypt.
 * @param sessionKey  - Derived AES-256-GCM CryptoKey.
 * @param sessionId   - Session ID (used as AAD prefix for binding).
 * @param sequence    - Monotonic sequence number (used as AAD for replay protection).
 * @returns Ciphertext, IV, auth tag, and AAD — all base64url-encoded.
 */
export async function encryptMessage(
  plaintext: string,
  sessionKey: CryptoKey,
  sessionId: string,
  sequence: number,
): Promise<{
  ciphertext: string;
  iv: string;
  auth_tag: string;
  aad: string;
}> {
  // 96-bit random IV (NIST SP 800-38D recommendation for GCM)
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  // Additional Authenticated Data: session_id + sequence
  // This binds the ciphertext to a specific session and position
  const aadString = `${sessionId}:${sequence}`;
  const aadBytes = new TextEncoder().encode(aadString);

  const plaintextBytes = new TextEncoder().encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aadBytes, tagLength: 128 },
    sessionKey,
    plaintextBytes,
  );

  // Web Crypto API appends the auth tag to the ciphertext
  // Split into ciphertext + tag (last 16 bytes = 128-bit tag)
  const encryptedArray = new Uint8Array(encrypted);
  const ciphertextBytes = encryptedArray.slice(0, encryptedArray.length - 16);
  const authTagBytes = encryptedArray.slice(encryptedArray.length - 16);

  return {
    ciphertext: base64urlEncode(ciphertextBytes),
    iv: base64urlEncode(iv),
    auth_tag: base64urlEncode(authTagBytes),
    aad: base64urlEncode(aadBytes),
  };
}

/**
 * Decrypt an AES-256-GCM encrypted message.
 *
 * @param ciphertext  - Base64url-encoded ciphertext.
 * @param iv          - Base64url-encoded 96-bit IV.
 * @param authTag     - Base64url-encoded 128-bit GCM auth tag.
 * @param aad         - Base64url-encoded additional authenticated data.
 * @param sessionKey  - Derived AES-256-GCM CryptoKey.
 * @returns Decrypted UTF-8 plaintext.
 * @throws If decryption fails (tampered ciphertext, wrong key, wrong AAD).
 */
export async function decryptMessage(
  ciphertext: string,
  iv: string,
  authTag: string,
  aad: string,
  sessionKey: CryptoKey,
): Promise<string> {
  const ciphertextBytes = base64urlDecode(ciphertext);
  const ivBytes = base64urlDecode(iv);
  const authTagBytes = base64urlDecode(authTag);
  const aadBytes = base64urlDecode(aad);

  // Reconstruct the combined ciphertext + tag that Web Crypto expects
  const combined = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
  combined.set(ciphertextBytes);
  combined.set(authTagBytes, ciphertextBytes.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes, additionalData: aadBytes, tagLength: 128 },
    sessionKey,
    combined,
  );

  return new TextDecoder().decode(decrypted);
}

// ──────────────────────────────────────────────
// Session-specific IV generation (deterministic)
// ──────────────────────────────────────────────

/**
 * Generate a unique IV by combining randomness with the sequence number.
 * This provides defense-in-depth against IV reuse even if the RNG is weak.
 *
 * Format: 4 bytes random || 4 bytes session hash || 4 bytes sequence (big-endian)
 */
export function generateSequenceIV(sessionId: string, sequence: number): Uint8Array {
  const iv = new Uint8Array(12);

  // First 4 bytes: random
  crypto.getRandomValues(iv.subarray(0, 4));

  // Middle 4 bytes: hash of session ID (for cross-session uniqueness)
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  }
  const view = new DataView(iv.buffer);
  view.setInt32(4, hash);

  // Last 4 bytes: sequence number (big-endian)
  view.setUint32(8, sequence);

  return iv;
}
