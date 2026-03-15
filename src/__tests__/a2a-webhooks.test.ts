import { describe, expect, it } from 'vitest';
import {
  signPayload,
  verifySignature,
  matchesPattern,
  subscriptionMatchesEvent,
  hashSecret,
  ALL_EVENT_TYPES,
  EVENT_DOMAINS,
} from '@/lib/a2a/webhooks';

// ──────────────────────────────────────────────
// HMAC Signature Verification
// ──────────────────────────────────────────────

describe('webhook HMAC signatures', () => {
  const testSecret = 'whsec_test_32_chars_minimum_length!!';
  const testPayload = JSON.stringify({
    event_id: '550e8400-e29b-41d4-a716-446655440000',
    event_type: 'task.completed',
    timestamp: '2028-03-14T12:00:00.000Z',
    api_version: '2028-03-14',
    data: { task_id: 'abc-123', intent: 'news.query' },
  });

  it('produces deterministic sha256= prefixed signatures', async () => {
    const sig1 = await signPayload(testPayload, testSecret);
    const sig2 = await signPayload(testPayload, testSecret);
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('verifies a valid signature', async () => {
    const sig = await signPayload(testPayload, testSecret);
    const valid = await verifySignature(testPayload, sig, testSecret);
    expect(valid).toBe(true);
  });

  it('rejects a tampered payload', async () => {
    const sig = await signPayload(testPayload, testSecret);
    const tampered = testPayload.replace('abc-123', 'evil-id');
    const valid = await verifySignature(tampered, sig, testSecret);
    expect(valid).toBe(false);
  });

  it('rejects a wrong secret', async () => {
    const sig = await signPayload(testPayload, testSecret);
    const valid = await verifySignature(testPayload, sig, 'wrong_secret_that_is_32_chars!!!');
    expect(valid).toBe(false);
  });

  it('rejects a forged signature', async () => {
    const forged = 'sha256=' + '0'.repeat(64);
    const valid = await verifySignature(testPayload, forged, testSecret);
    expect(valid).toBe(false);
  });

  it('rejects signatures with different lengths (timing-safe)', async () => {
    const valid = await verifySignature(testPayload, 'sha256=short', testSecret);
    expect(valid).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Event Pattern Matching
// ──────────────────────────────────────────────

describe('event pattern matching', () => {
  it('matches exact event types', () => {
    expect(matchesPattern('task.completed', 'task.completed')).toBe(true);
    expect(matchesPattern('task.failed', 'task.completed')).toBe(false);
  });

  it('matches domain wildcards', () => {
    expect(matchesPattern('task.completed', 'task.*')).toBe(true);
    expect(matchesPattern('task.failed', 'task.*')).toBe(true);
    expect(matchesPattern('task.assigned', 'task.*')).toBe(true);
    expect(matchesPattern('agent.registered', 'task.*')).toBe(false);
    expect(matchesPattern('news.published', 'news.*')).toBe(true);
  });

  it('matches global wildcard', () => {
    expect(matchesPattern('task.completed', '*')).toBe(true);
    expect(matchesPattern('agent.registered', '*')).toBe(true);
    expect(matchesPattern('news.published', '*')).toBe(true);
  });

  it('does not match partial strings', () => {
    expect(matchesPattern('task.completed', 'task.comp')).toBe(false);
    expect(matchesPattern('task.completed', 'task')).toBe(false);
  });
});

describe('subscription event matching', () => {
  it('matches if any pattern matches', () => {
    const patterns = ['task.completed', 'agent.*'] as const;
    expect(subscriptionMatchesEvent([...patterns], 'task.completed')).toBe(true);
    expect(subscriptionMatchesEvent([...patterns], 'agent.registered')).toBe(true);
    expect(subscriptionMatchesEvent([...patterns], 'news.published')).toBe(false);
  });

  it('global wildcard catches everything', () => {
    expect(subscriptionMatchesEvent(['*'], 'task.completed')).toBe(true);
    expect(subscriptionMatchesEvent(['*'], 'digest.published')).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Secret Hashing
// ──────────────────────────────────────────────

describe('subscription secret hashing', () => {
  it('produces a SHA-256 hash and prefix', async () => {
    const secret = 'whsec_test_secret_that_is_long_enough';
    const { secretHash, secretPrefix } = await hashSecret(secret);
    expect(secretHash).toMatch(/^[0-9a-f]{64}$/);
    expect(secretPrefix).toBe('whsec_te');
  });

  it('is deterministic', async () => {
    const secret = 'deterministic_test_secret_32chars!';
    const r1 = await hashSecret(secret);
    const r2 = await hashSecret(secret);
    expect(r1.secretHash).toBe(r2.secretHash);
  });

  it('different secrets produce different hashes', async () => {
    const r1 = await hashSecret('secret_one_that_is_32_characters');
    const r2 = await hashSecret('secret_two_that_is_32_characters');
    expect(r1.secretHash).not.toBe(r2.secretHash);
  });
});

// ──────────────────────────────────────────────
// Event Type & Domain Constants
// ──────────────────────────────────────────────

describe('event taxonomy', () => {
  it('includes all core event types', () => {
    expect(ALL_EVENT_TYPES).toContain('task.completed');
    expect(ALL_EVENT_TYPES).toContain('task.failed');
    expect(ALL_EVENT_TYPES).toContain('task.assigned');
    expect(ALL_EVENT_TYPES).toContain('agent.registered');
    expect(ALL_EVENT_TYPES).toContain('news.published');
    expect(ALL_EVENT_TYPES).toContain('digest.published');
    expect(ALL_EVENT_TYPES.length).toBeGreaterThanOrEqual(8);
  });

  it('all event types belong to known domains', () => {
    for (const event of ALL_EVENT_TYPES) {
      const domain = event.split('.')[0];
      expect((EVENT_DOMAINS as readonly string[]).includes(domain)).toBe(true);
    }
  });

  it('event domains cover all prefixes', () => {
    expect(EVENT_DOMAINS).toContain('task');
    expect(EVENT_DOMAINS).toContain('agent');
    expect(EVENT_DOMAINS).toContain('news');
    expect(EVENT_DOMAINS).toContain('digest');
    expect(EVENT_DOMAINS).toContain('capability');
  });
});
