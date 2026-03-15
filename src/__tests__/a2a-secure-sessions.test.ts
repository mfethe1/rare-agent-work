/**
 * A2A Secure Sessions — Unit Tests
 *
 * Tests the crypto primitives and validation schemas for secure sessions.
 * Database-dependent functions (engine.ts) are tested via integration tests.
 */

import {
  generateEphemeralKeyPair,
  importEphemeralPublicKey,
  isValidEphemeralPublicKey,
  deriveSessionKey,
  generateSalt,
  encryptMessage,
  decryptMessage,
  generateSequenceIV,
  sessionEstablishSchema,
  sessionAcceptSchema,
  sessionSendSchema,
  sessionTerminateSchema,
  sessionListSchema,
} from '@/lib/a2a/sessions';
import { base64urlEncode, base64urlDecode } from '@/lib/a2a/identity';

// ──────────────────────────────────────────────
// ECDH P-256 Key Generation
// ──────────────────────────────────────────────

describe('ECDH P-256 ephemeral key operations', () => {
  it('generates an ephemeral key pair with 65-byte uncompressed public key', async () => {
    const { publicKey } = await generateEphemeralKeyPair();
    const bytes = base64urlDecode(publicKey);
    expect(bytes.length).toBe(65);
    // Uncompressed point format: 0x04 prefix
    expect(bytes[0]).toBe(0x04);
  });

  it('generates unique key pairs', async () => {
    const kp1 = await generateEphemeralKeyPair();
    const kp2 = await generateEphemeralKeyPair();
    expect(kp1.publicKey).not.toBe(kp2.publicKey);
  });

  it('validates well-formed P-256 public keys', async () => {
    const { publicKey } = await generateEphemeralKeyPair();
    expect(isValidEphemeralPublicKey(publicKey)).toBe(true);
  });

  it('rejects invalid public keys', () => {
    expect(isValidEphemeralPublicKey('')).toBe(false);
    expect(isValidEphemeralPublicKey('not-a-key')).toBe(false);
    // Wrong length (32 bytes instead of 65)
    const short = base64urlEncode(new Uint8Array(32));
    expect(isValidEphemeralPublicKey(short)).toBe(false);
    // Right length but wrong prefix
    const wrongPrefix = new Uint8Array(65);
    wrongPrefix[0] = 0x02; // compressed format, not uncompressed
    expect(isValidEphemeralPublicKey(base64urlEncode(wrongPrefix))).toBe(false);
  });

  it('imports a valid P-256 public key', async () => {
    const { publicKey } = await generateEphemeralKeyPair();
    const imported = await importEphemeralPublicKey(publicKey);
    expect(imported).toBeDefined();
    expect(imported.type).toBe('public');
  });

  it('rejects importing invalid P-256 public keys', async () => {
    await expect(
      importEphemeralPublicKey(base64urlEncode(new Uint8Array(32))),
    ).rejects.toThrow('expected 65 bytes');
  });
});

// ──────────────────────────────────────────────
// HKDF Salt Generation
// ──────────────────────────────────────────────

describe('HKDF salt generation', () => {
  it('generates unique 32-byte salts', () => {
    const s1 = generateSalt();
    const s2 = generateSalt();
    expect(s1).not.toBe(s2);
    expect(base64urlDecode(s1).length).toBe(32);
    expect(base64urlDecode(s2).length).toBe(32);
  });
});

// ──────────────────────────────────────────────
// Full Key Exchange + Encryption/Decryption
// ──────────────────────────────────────────────

describe('ECDH key agreement + AES-256-GCM encryption', () => {
  it('derives the same session key from both sides', async () => {
    const alice = await generateEphemeralKeyPair();
    const bob = await generateEphemeralKeyPair();
    const salt = generateSalt();

    // Alice derives key using her private + Bob's public
    const aliceKey = await deriveSessionKey(alice.privateKey, bob.publicKey, salt);
    // Bob derives key using his private + Alice's public
    const bobKey = await deriveSessionKey(bob.privateKey, alice.publicKey, salt);

    // Both should be AES-GCM keys
    expect(aliceKey.algorithm).toEqual({ name: 'AES-GCM', length: 256 });
    expect(bobKey.algorithm).toEqual({ name: 'AES-GCM', length: 256 });

    // Verify by encrypting with Alice's key and decrypting with Bob's
    const sessionId = 'test-session-id';
    const plaintext = 'Hello from Agent Alice to Agent Bob!';

    const encrypted = await encryptMessage(plaintext, aliceKey, sessionId, 0);
    const decrypted = await decryptMessage(
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.auth_tag,
      encrypted.aad,
      bobKey,
    );

    expect(decrypted).toBe(plaintext);
  });

  it('encrypts and decrypts a message round-trip', async () => {
    const alice = await generateEphemeralKeyPair();
    const bob = await generateEphemeralKeyPair();
    const salt = generateSalt();

    const sessionKey = await deriveSessionKey(alice.privateKey, bob.publicKey, salt);
    const sessionId = 'session-123';
    const plaintext = 'Sensitive agent data: {"balance": 42.0, "action": "transfer"}';

    const encrypted = await encryptMessage(plaintext, sessionKey, sessionId, 0);

    // Verify all fields are present and base64url-encoded
    expect(encrypted.ciphertext).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encrypted.iv).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encrypted.auth_tag).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encrypted.aad).toMatch(/^[A-Za-z0-9_-]+$/);

    // IV should be 12 bytes
    expect(base64urlDecode(encrypted.iv).length).toBe(12);
    // Auth tag should be 16 bytes (128-bit)
    expect(base64urlDecode(encrypted.auth_tag).length).toBe(16);

    // Decrypt
    const decrypted = await decryptMessage(
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.auth_tag,
      encrypted.aad,
      sessionKey,
    );
    expect(decrypted).toBe(plaintext);
  });

  it('detects ciphertext tampering', async () => {
    const alice = await generateEphemeralKeyPair();
    const bob = await generateEphemeralKeyPair();
    const salt = generateSalt();
    const sessionKey = await deriveSessionKey(alice.privateKey, bob.publicKey, salt);

    const encrypted = await encryptMessage('secret', sessionKey, 'session-1', 0);

    // Tamper with ciphertext
    const tamperedCiphertext = base64urlEncode(
      new Uint8Array(base64urlDecode(encrypted.ciphertext).map((b) => b ^ 0xff)),
    );

    await expect(
      decryptMessage(tamperedCiphertext, encrypted.iv, encrypted.auth_tag, encrypted.aad, sessionKey),
    ).rejects.toThrow();
  });

  it('detects auth tag tampering', async () => {
    const alice = await generateEphemeralKeyPair();
    const bob = await generateEphemeralKeyPair();
    const salt = generateSalt();
    const sessionKey = await deriveSessionKey(alice.privateKey, bob.publicKey, salt);

    const encrypted = await encryptMessage('secret', sessionKey, 'session-1', 0);

    // Tamper with auth tag
    const badTag = base64urlEncode(new Uint8Array(16)); // all zeros

    await expect(
      decryptMessage(encrypted.ciphertext, encrypted.iv, badTag, encrypted.aad, sessionKey),
    ).rejects.toThrow();
  });

  it('rejects decryption with wrong AAD (replay protection)', async () => {
    const alice = await generateEphemeralKeyPair();
    const bob = await generateEphemeralKeyPair();
    const salt = generateSalt();
    const sessionKey = await deriveSessionKey(alice.privateKey, bob.publicKey, salt);

    const encrypted = await encryptMessage('secret', sessionKey, 'session-1', 0);

    // Try decrypting with wrong AAD (different sequence number)
    const wrongAad = Buffer.from('session-1:999').toString('base64url');

    await expect(
      decryptMessage(encrypted.ciphertext, encrypted.iv, encrypted.auth_tag, wrongAad, sessionKey),
    ).rejects.toThrow();
  });

  it('rejects decryption with wrong key', async () => {
    const alice = await generateEphemeralKeyPair();
    const bob = await generateEphemeralKeyPair();
    const charlie = await generateEphemeralKeyPair();
    const salt = generateSalt();

    const aliceBobKey = await deriveSessionKey(alice.privateKey, bob.publicKey, salt);
    const charlieKey = await deriveSessionKey(charlie.privateKey, bob.publicKey, salt);

    const encrypted = await encryptMessage('secret', aliceBobKey, 'session-1', 0);

    // Charlie should not be able to decrypt Alice→Bob messages
    await expect(
      decryptMessage(encrypted.ciphertext, encrypted.iv, encrypted.auth_tag, encrypted.aad, charlieKey),
    ).rejects.toThrow();
  });

  it('different salts produce different keys (no cross-session decryption)', async () => {
    const alice = await generateEphemeralKeyPair();
    const bob = await generateEphemeralKeyPair();
    const salt1 = generateSalt();
    const salt2 = generateSalt();

    const key1 = await deriveSessionKey(alice.privateKey, bob.publicKey, salt1);
    const key2 = await deriveSessionKey(alice.privateKey, bob.publicKey, salt2);

    const encrypted = await encryptMessage('secret', key1, 'session-1', 0);

    // Key from different salt should fail to decrypt
    await expect(
      decryptMessage(encrypted.ciphertext, encrypted.iv, encrypted.auth_tag, encrypted.aad, key2),
    ).rejects.toThrow();
  });

  it('handles empty string encryption', async () => {
    const alice = await generateEphemeralKeyPair();
    const bob = await generateEphemeralKeyPair();
    const salt = generateSalt();
    const sessionKey = await deriveSessionKey(alice.privateKey, bob.publicKey, salt);

    const encrypted = await encryptMessage('', sessionKey, 'session-1', 0);
    const decrypted = await decryptMessage(
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.auth_tag,
      encrypted.aad,
      sessionKey,
    );
    expect(decrypted).toBe('');
  });

  it('handles large payloads', async () => {
    const alice = await generateEphemeralKeyPair();
    const bob = await generateEphemeralKeyPair();
    const salt = generateSalt();
    const sessionKey = await deriveSessionKey(alice.privateKey, bob.publicKey, salt);

    // 100KB payload
    const largePlaintext = 'A'.repeat(100_000);
    const encrypted = await encryptMessage(largePlaintext, sessionKey, 'session-1', 0);
    const decrypted = await decryptMessage(
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.auth_tag,
      encrypted.aad,
      sessionKey,
    );
    expect(decrypted).toBe(largePlaintext);
  });

  it('supports bidirectional communication', async () => {
    const alice = await generateEphemeralKeyPair();
    const bob = await generateEphemeralKeyPair();
    const salt = generateSalt();

    const aliceKey = await deriveSessionKey(alice.privateKey, bob.publicKey, salt);
    const bobKey = await deriveSessionKey(bob.privateKey, alice.publicKey, salt);
    const sessionId = 'bidirectional-session';

    // Alice sends to Bob
    const msg1 = await encryptMessage('Hello Bob', aliceKey, sessionId, 0);
    const dec1 = await decryptMessage(msg1.ciphertext, msg1.iv, msg1.auth_tag, msg1.aad, bobKey);
    expect(dec1).toBe('Hello Bob');

    // Bob sends to Alice
    const msg2 = await encryptMessage('Hello Alice', bobKey, sessionId, 0);
    const dec2 = await decryptMessage(msg2.ciphertext, msg2.iv, msg2.auth_tag, msg2.aad, aliceKey);
    expect(dec2).toBe('Hello Alice');

    // Multiple rounds
    const msg3 = await encryptMessage('Round 2 from Alice', aliceKey, sessionId, 1);
    const dec3 = await decryptMessage(msg3.ciphertext, msg3.iv, msg3.auth_tag, msg3.aad, bobKey);
    expect(dec3).toBe('Round 2 from Alice');
  });
});

// ──────────────────────────────────────────────
// Sequence IV Generation
// ──────────────────────────────────────────────

describe('sequence IV generation', () => {
  it('generates 12-byte IVs', () => {
    const iv = generateSequenceIV('session-123', 0);
    expect(iv.length).toBe(12);
  });

  it('generates different IVs for different sequences', () => {
    const iv0 = generateSequenceIV('session-123', 0);
    const iv1 = generateSequenceIV('session-123', 1);
    // Last 4 bytes should differ (sequence encoded as big-endian)
    expect(iv0.slice(8)).not.toEqual(iv1.slice(8));
  });

  it('generates different IVs for different sessions', () => {
    const ivA = generateSequenceIV('session-A', 0);
    const ivB = generateSequenceIV('session-B', 0);
    // Middle 4 bytes should differ (session hash)
    expect(ivA.slice(4, 8)).not.toEqual(ivB.slice(4, 8));
  });
});

// ──────────────────────────────────────────────
// Validation Schemas
// ──────────────────────────────────────────────

describe('sessionEstablishSchema', () => {
  // Generate a fake 65-byte P-256 public key for validation tests
  const fakeP256Key = base64urlEncode(
    new Uint8Array([0x04, ...new Array(64).fill(0xAB)]),
  );
  const fakeSignature = base64urlEncode(new Uint8Array(64));

  it('accepts a valid establishment request', () => {
    const result = sessionEstablishSchema.safeParse({
      responder_agent_id: '550e8400-e29b-41d4-a716-446655440000',
      ephemeral_public_key: fakeP256Key,
      key_signature: fakeSignature,
      identity_key_id: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ttl_seconds).toBe(3600); // default
    }
  });

  it('accepts with all optional fields', () => {
    const result = sessionEstablishSchema.safeParse({
      responder_agent_id: '550e8400-e29b-41d4-a716-446655440000',
      ephemeral_public_key: fakeP256Key,
      key_signature: fakeSignature,
      identity_key_id: '550e8400-e29b-41d4-a716-446655440001',
      ttl_seconds: 7200,
      purpose: 'Exchanging financial data',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    expect(sessionEstablishSchema.safeParse({}).success).toBe(false);
    expect(sessionEstablishSchema.safeParse({
      responder_agent_id: '550e8400-e29b-41d4-a716-446655440000',
    }).success).toBe(false);
  });

  it('rejects TTL outside bounds', () => {
    expect(sessionEstablishSchema.safeParse({
      responder_agent_id: '550e8400-e29b-41d4-a716-446655440000',
      ephemeral_public_key: fakeP256Key,
      key_signature: fakeSignature,
      identity_key_id: '550e8400-e29b-41d4-a716-446655440001',
      ttl_seconds: 10, // too short (min 60)
    }).success).toBe(false);

    expect(sessionEstablishSchema.safeParse({
      responder_agent_id: '550e8400-e29b-41d4-a716-446655440000',
      ephemeral_public_key: fakeP256Key,
      key_signature: fakeSignature,
      identity_key_id: '550e8400-e29b-41d4-a716-446655440001',
      ttl_seconds: 100000, // too long (max 86400)
    }).success).toBe(false);
  });
});

describe('sessionAcceptSchema', () => {
  const fakeP256Key = base64urlEncode(
    new Uint8Array([0x04, ...new Array(64).fill(0xCD)]),
  );
  const fakeSignature = base64urlEncode(new Uint8Array(64));

  it('accepts a valid acceptance request', () => {
    const result = sessionAcceptSchema.safeParse({
      ephemeral_public_key: fakeP256Key,
      key_signature: fakeSignature,
      identity_key_id: '550e8400-e29b-41d4-a716-446655440002',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing fields', () => {
    expect(sessionAcceptSchema.safeParse({}).success).toBe(false);
  });
});

describe('sessionSendSchema', () => {
  it('accepts a valid send request', () => {
    const result = sessionSendSchema.safeParse({
      session_id: '550e8400-e29b-41d4-a716-446655440003',
      sequence: 0,
      ciphertext: base64urlEncode(new Uint8Array(100)),
      iv: base64urlEncode(new Uint8Array(12)),
      auth_tag: base64urlEncode(new Uint8Array(16)),
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative sequence number', () => {
    const result = sessionSendSchema.safeParse({
      session_id: '550e8400-e29b-41d4-a716-446655440003',
      sequence: -1,
      ciphertext: 'abc',
      iv: base64urlEncode(new Uint8Array(12)),
      auth_tag: base64urlEncode(new Uint8Array(16)),
    });
    expect(result.success).toBe(false);
  });
});

describe('sessionTerminateSchema', () => {
  it('accepts a valid termination request', () => {
    const result = sessionTerminateSchema.safeParse({
      session_id: '550e8400-e29b-41d4-a716-446655440004',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    const result = sessionTerminateSchema.safeParse({
      session_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

describe('sessionListSchema', () => {
  it('accepts empty query (defaults)', () => {
    const result = sessionListSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.status).toBeUndefined();
    }
  });

  it('accepts valid status filter', () => {
    const result = sessionListSchema.safeParse({ status: 'active', limit: 50 });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = sessionListSchema.safeParse({ status: 'invalid' });
    expect(result.success).toBe(false);
  });
});
