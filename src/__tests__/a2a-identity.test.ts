/**
 * A2A Cryptographic Agent Identity — Unit Tests
 *
 * Tests the pure crypto primitives and validation schemas.
 * Database-dependent functions (engine.ts) are tested via integration tests.
 */

import {
  base64urlEncode,
  base64urlDecode,
  base64urlEncodeJson,
  base64urlDecodeJson,
  generateKeyPair,
  computeFingerprint,
  isValidPublicKey,
  signBytes,
  verifySignature,
  canonicalize,
  canonicalizeToString,
  createSignedEnvelope,
  verifyEnvelopeSignature,
  generateNonce,
  createDelegationToken,
  parseDelegationToken,
  verifyDelegationToken,
  keyRegisterSchema,
  keyRevokeSchema,
  challengeRequestSchema,
  challengeVerifySchema,
  signPayloadSchema,
  delegationTokenSchema,
  verifyDelegationTokenSchema,
} from '@/lib/a2a/identity';

// ──────────────────────────────────────────────
// Base64url Encoding/Decoding
// ──────────────────────────────────────────────

describe('base64url encoding', () => {
  it('round-trips arbitrary bytes', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255]);
    const encoded = base64urlEncode(original);
    const decoded = base64urlDecode(encoded);
    expect(decoded).toEqual(original);
  });

  it('produces URL-safe output without padding', () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const encoded = base64urlEncode(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('round-trips JSON objects', () => {
    const obj = { hello: 'world', num: 42, nested: { a: true } };
    const encoded = base64urlEncodeJson(obj);
    const decoded = base64urlDecodeJson(encoded);
    expect(decoded).toEqual(obj);
  });
});

// ──────────────────────────────────────────────
// Key Generation & Validation
// ──────────────────────────────────────────────

describe('Ed25519 key operations', () => {
  it('generates a key pair with 32-byte public key', async () => {
    const { publicKey } = await generateKeyPair();
    const bytes = base64urlDecode(publicKey);
    expect(bytes.length).toBe(32);
  });

  it('generates unique key pairs', async () => {
    const kp1 = await generateKeyPair();
    const kp2 = await generateKeyPair();
    expect(kp1.publicKey).not.toBe(kp2.publicKey);
  });

  it('validates well-formed public keys', async () => {
    const { publicKey } = await generateKeyPair();
    expect(isValidPublicKey(publicKey)).toBe(true);
  });

  it('rejects invalid public keys', () => {
    expect(isValidPublicKey('')).toBe(false);
    expect(isValidPublicKey('not-a-key')).toBe(false);
    // Too short (only 16 bytes)
    const short = base64urlEncode(new Uint8Array(16));
    expect(isValidPublicKey(short)).toBe(false);
  });

  it('computes deterministic fingerprints', async () => {
    const { publicKey } = await generateKeyPair();
    const fp1 = await computeFingerprint(publicKey);
    const fp2 = await computeFingerprint(publicKey);
    expect(fp1).toBe(fp2);
    // Fingerprint is colon-separated hex
    expect(fp1).toMatch(/^[0-9a-f]{2}(:[0-9a-f]{2}){15}$/);
  });

  it('different keys produce different fingerprints', async () => {
    const kp1 = await generateKeyPair();
    const kp2 = await generateKeyPair();
    const fp1 = await computeFingerprint(kp1.publicKey);
    const fp2 = await computeFingerprint(kp2.publicKey);
    expect(fp1).not.toBe(fp2);
  });
});

// ──────────────────────────────────────────────
// Signing & Verification
// ──────────────────────────────────────────────

describe('Ed25519 signing', () => {
  it('signs and verifies a message', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const message = new TextEncoder().encode('hello agents');
    const signature = await signBytes(message, privateKey);
    const isValid = await verifySignature(message, signature, publicKey);
    expect(isValid).toBe(true);
  });

  it('rejects tampered messages', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const message = new TextEncoder().encode('original message');
    const signature = await signBytes(message, privateKey);
    const tampered = new TextEncoder().encode('tampered message');
    const isValid = await verifySignature(tampered, signature, publicKey);
    expect(isValid).toBe(false);
  });

  it('rejects wrong key verification', async () => {
    const kp1 = await generateKeyPair();
    const kp2 = await generateKeyPair();
    const message = new TextEncoder().encode('secret');
    const signature = await signBytes(message, kp1.privateKey);
    const isValid = await verifySignature(message, signature, kp2.publicKey);
    expect(isValid).toBe(false);
  });
});

// ──────────────────────────────────────────────
// JSON Canonicalization
// ──────────────────────────────────────────────

describe('JSON canonicalization', () => {
  it('sorts keys deterministically', () => {
    const a = canonicalizeToString({ z: 1, a: 2, m: 3 });
    const b = canonicalizeToString({ a: 2, m: 3, z: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"m":3,"z":1}');
  });

  it('sorts nested objects', () => {
    const result = canonicalizeToString({ b: { d: 1, c: 2 }, a: 3 });
    expect(result).toBe('{"a":3,"b":{"c":2,"d":1}}');
  });

  it('preserves array order', () => {
    const result = canonicalizeToString({ arr: [3, 1, 2] });
    expect(result).toBe('{"arr":[3,1,2]}');
  });

  it('handles null and undefined', () => {
    const result = canonicalizeToString({ a: null, b: undefined });
    expect(result).toBe('{"a":null}'); // undefined omitted by JSON.stringify
  });

  it('produces deterministic bytes', () => {
    const bytes1 = canonicalize({ x: 1, a: 2 });
    const bytes2 = canonicalize({ a: 2, x: 1 });
    expect(bytes1).toEqual(bytes2);
  });
});

// ──────────────────────────────────────────────
// Signed Envelopes
// ──────────────────────────────────────────────

describe('signed envelopes', () => {
  it('creates and verifies an envelope', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const fingerprint = await computeFingerprint(publicKey);

    const payload = { action: 'task.submit', target: 'agent-123' };
    const envelope = await createSignedEnvelope(
      payload,
      'agent-signer-id',
      'key-id-123',
      fingerprint,
      privateKey,
    );

    expect(envelope.payload).toEqual(payload);
    expect(envelope.signature.signer_agent_id).toBe('agent-signer-id');
    expect(envelope.signature.algorithm).toBe('Ed25519');

    const isValid = await verifyEnvelopeSignature(envelope, publicKey);
    expect(isValid).toBe(true);
  });

  it('detects payload tampering', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const fingerprint = await computeFingerprint(publicKey);

    const envelope = await createSignedEnvelope(
      { amount: 100 },
      'agent-id',
      'key-id',
      fingerprint,
      privateKey,
    );

    // Tamper with payload
    envelope.payload = { amount: 999 };
    const isValid = await verifyEnvelopeSignature(envelope, publicKey);
    expect(isValid).toBe(false);
  });

  it('rejects verification with wrong key', async () => {
    const kp1 = await generateKeyPair();
    const kp2 = await generateKeyPair();
    const fingerprint = await computeFingerprint(kp1.publicKey);

    const envelope = await createSignedEnvelope(
      { data: 'test' },
      'agent-id',
      'key-id',
      fingerprint,
      kp1.privateKey,
    );

    const isValid = await verifyEnvelopeSignature(envelope, kp2.publicKey);
    expect(isValid).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Nonce Generation
// ──────────────────────────────────────────────

describe('nonce generation', () => {
  it('generates unique nonces', () => {
    const n1 = generateNonce();
    const n2 = generateNonce();
    expect(n1).not.toBe(n2);
  });

  it('generates 32-byte nonces', () => {
    const nonce = generateNonce();
    const bytes = base64urlDecode(nonce);
    expect(bytes.length).toBe(32);
  });
});

// ──────────────────────────────────────────────
// Delegation Tokens
// ──────────────────────────────────────────────

describe('delegation tokens', () => {
  const baseClaims = {
    jti: 'token-id-123',
    iss: 'grantor-agent-id',
    sub: 'delegate-agent-id',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    scopes: ['task.submit', 'task.read'],
    allow_subdelegation: false,
    chain_depth: 0,
    max_chain_depth: 2,
    chain: ['grantor-agent-id'],
  };

  it('creates and parses a compact token', async () => {
    const { privateKey } = await generateKeyPair();
    const { token, parsed } = await createDelegationToken(
      baseClaims,
      'key-id-456',
      privateKey,
    );

    // Token is three dot-separated parts
    expect(token.split('.').length).toBe(3);

    // Parsed matches
    expect(parsed.header.alg).toBe('Ed25519');
    expect(parsed.header.typ).toBe('a2a-delegation+ed25519');
    expect(parsed.claims.iss).toBe('grantor-agent-id');
    expect(parsed.claims.sub).toBe('delegate-agent-id');
    expect(parsed.claims.scopes).toEqual(['task.submit', 'task.read']);

    // Can re-parse from compact form
    const reParsed = parseDelegationToken(token);
    expect(reParsed.claims).toEqual(parsed.claims);
  });

  it('verifies a valid token', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const { token } = await createDelegationToken(
      baseClaims,
      'key-id-789',
      privateKey,
    );

    const result = await verifyDelegationToken(token, publicKey);
    expect(result.valid).toBe(true);
    expect(result.claims).not.toBeNull();
    expect(result.claims?.iss).toBe('grantor-agent-id');
  });

  it('rejects an expired token', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const expiredClaims = {
      ...baseClaims,
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600,
      nbf: Math.floor(Date.now() / 1000) - 7200,
    };

    const { token } = await createDelegationToken(
      expiredClaims,
      'key-id',
      privateKey,
    );

    const result = await verifyDelegationToken(token, publicKey);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Token expired');
  });

  it('rejects a not-yet-valid token', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const futureClaims = {
      ...baseClaims,
      nbf: Math.floor(Date.now() / 1000) + 3600,
    };

    const { token } = await createDelegationToken(
      futureClaims,
      'key-id',
      privateKey,
    );

    const result = await verifyDelegationToken(token, publicKey);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Token not yet valid');
  });

  it('rejects a token signed with wrong key', async () => {
    const kp1 = await generateKeyPair();
    const kp2 = await generateKeyPair();
    const { token } = await createDelegationToken(
      baseClaims,
      'key-id',
      kp1.privateKey,
    );

    const result = await verifyDelegationToken(token, kp2.publicKey);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Invalid signature');
  });

  it('rejects a malformed token', async () => {
    const { publicKey } = await generateKeyPair();
    const result = await verifyDelegationToken('not.a.valid.token', publicKey);
    expect(result.valid).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation Schemas
// ──────────────────────────────────────────────

describe('keyRegisterSchema', () => {
  it('accepts a valid Ed25519 public key', async () => {
    const { publicKey } = await generateKeyPair();
    const result = keyRegisterSchema.safeParse({
      public_key: publicKey,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all optional fields', async () => {
    const { publicKey } = await generateKeyPair();
    const result = keyRegisterSchema.safeParse({
      public_key: publicKey,
      algorithm: 'Ed25519',
      label: 'production',
      is_primary: true,
      expires_at: '2029-01-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing public_key', () => {
    const result = keyRegisterSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('keyRevokeSchema', () => {
  it('accepts a valid revocation reason', () => {
    const result = keyRevokeSchema.safeParse({ reason: 'Key compromised' });
    expect(result.success).toBe(true);
  });

  it('rejects empty reason', () => {
    const result = keyRevokeSchema.safeParse({ reason: '' });
    expect(result.success).toBe(false);
  });
});

describe('challengeRequestSchema', () => {
  it('accepts empty object (uses primary key)', () => {
    const result = challengeRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts a specific key_id', () => {
    const result = challengeRequestSchema.safeParse({
      key_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID key_id', () => {
    const result = challengeRequestSchema.safeParse({ key_id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

describe('challengeVerifySchema', () => {
  it('accepts valid challenge verification', () => {
    const result = challengeVerifySchema.safeParse({
      challenge_id: '550e8400-e29b-41d4-a716-446655440000',
      signature: 'abcdefABCDEF0123456789_-',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing fields', () => {
    expect(challengeVerifySchema.safeParse({}).success).toBe(false);
    expect(challengeVerifySchema.safeParse({ challenge_id: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(false);
  });
});

describe('signPayloadSchema', () => {
  it('accepts a valid payload', () => {
    const result = signPayloadSchema.safeParse({
      payload: { action: 'test', data: { nested: true } },
    });
    expect(result.success).toBe(true);
  });

  it('accepts with optional key_id', () => {
    const result = signPayloadSchema.safeParse({
      payload: { x: 1 },
      key_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });
});

describe('delegationTokenSchema', () => {
  it('accepts a valid delegation token request', () => {
    const result = delegationTokenSchema.safeParse({
      delegate_agent_id: '550e8400-e29b-41d4-a716-446655440000',
      scopes: ['task.submit', 'task.read'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allow_subdelegation).toBe(false);
      expect(result.data.max_chain_depth).toBe(2);
      expect(result.data.duration_seconds).toBe(3600);
    }
  });

  it('accepts full options', () => {
    const result = delegationTokenSchema.safeParse({
      delegate_agent_id: '550e8400-e29b-41d4-a716-446655440000',
      scopes: ['billing.spend'],
      resource_ids: ['550e8400-e29b-41d4-a716-446655440001'],
      spend_limit_per_action: 50,
      spend_limit_total: 500,
      allow_subdelegation: true,
      max_chain_depth: 5,
      duration_seconds: 7200,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing scopes', () => {
    const result = delegationTokenSchema.safeParse({
      delegate_agent_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty scopes array', () => {
    const result = delegationTokenSchema.safeParse({
      delegate_agent_id: '550e8400-e29b-41d4-a716-446655440000',
      scopes: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('verifyDelegationTokenSchema', () => {
  it('accepts a token string', () => {
    const result = verifyDelegationTokenSchema.safeParse({
      token: 'header.claims.signature',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty token', () => {
    const result = verifyDelegationTokenSchema.safeParse({ token: '' });
    expect(result.success).toBe(false);
  });
});
