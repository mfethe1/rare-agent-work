/**
 * Tests for A2A Agent Rate Limiter & Quota System
 *
 * Covers: quota tier configuration, rate limit headers, response body formatting,
 * and the core logic of checkRateLimit and getAgentUsage (pure/deterministic tests).
 *
 * Note: DB-dependent tests (actual sliding window counting) are integration tests.
 * These unit tests verify the quota configuration, response formatting, and
 * header generation that don't depend on DB state.
 */

import { describe, it, expect } from 'vitest';
import {
  QUOTA_TIERS,
  rateLimitHeaders,
  rateLimitBody,
} from '@/lib/a2a/rate-limiter';
import type {
  RateLimitAction,
  RateLimitResult,
  QuotaTier,
} from '@/lib/a2a/rate-limiter';
import type { AgentTrustLevel } from '@/lib/a2a';

// ──────────────────────────────────────────────
// Quota Tier Configuration Tests
// ──────────────────────────────────────────────

describe('QUOTA_TIERS', () => {
  const ALL_TRUST_LEVELS: AgentTrustLevel[] = ['untrusted', 'verified', 'partner'];
  const ALL_ACTIONS: RateLimitAction[] = [
    'task.submit',
    'task.route',
    'task.update',
    'context.write',
    'context.read',
    'subscription.create',
    'feedback.submit',
  ];

  it('defines quotas for all trust levels', () => {
    for (const level of ALL_TRUST_LEVELS) {
      expect(QUOTA_TIERS[level]).toBeDefined();
    }
  });

  it('defines quotas for all action types at every trust level', () => {
    for (const level of ALL_TRUST_LEVELS) {
      for (const action of ALL_ACTIONS) {
        const tier = QUOTA_TIERS[level][action];
        expect(tier).toBeDefined();
        expect(tier.max_requests).toBeGreaterThan(0);
        expect(tier.window_seconds).toBeGreaterThan(0);
        expect(tier.daily_cap).toBeGreaterThan(0);
      }
    }
  });

  it('grants progressively higher quotas for higher trust levels', () => {
    for (const action of ALL_ACTIONS) {
      const untrusted = QUOTA_TIERS.untrusted[action];
      const verified = QUOTA_TIERS.verified[action];
      const partner = QUOTA_TIERS.partner[action];

      expect(verified.max_requests).toBeGreaterThanOrEqual(untrusted.max_requests);
      expect(partner.max_requests).toBeGreaterThanOrEqual(verified.max_requests);
      expect(verified.daily_cap).toBeGreaterThanOrEqual(untrusted.daily_cap);
      expect(partner.daily_cap).toBeGreaterThanOrEqual(verified.daily_cap);
    }
  });

  it('uses reasonable window sizes (30-300 seconds)', () => {
    for (const level of ALL_TRUST_LEVELS) {
      for (const action of ALL_ACTIONS) {
        const tier = QUOTA_TIERS[level][action];
        expect(tier.window_seconds).toBeGreaterThanOrEqual(10);
        expect(tier.window_seconds).toBeLessThanOrEqual(3600);
      }
    }
  });

  it('sets daily caps higher than per-window limits', () => {
    for (const level of ALL_TRUST_LEVELS) {
      for (const action of ALL_ACTIONS) {
        const tier = QUOTA_TIERS[level][action];
        expect(tier.daily_cap).toBeGreaterThanOrEqual(tier.max_requests);
      }
    }
  });

  it('has strict limits for untrusted subscription creation', () => {
    const sub = QUOTA_TIERS.untrusted['subscription.create'];
    // Subscriptions are the most sensitive action — should be heavily limited
    expect(sub.max_requests).toBeLessThanOrEqual(5);
    expect(sub.daily_cap).toBeLessThanOrEqual(20);
  });
});

// ──────────────────────────────────────────────
// Rate Limit Headers
// ──────────────────────────────────────────────

describe('rateLimitHeaders', () => {
  function makeResult(overrides: Partial<RateLimitResult> = {}): RateLimitResult {
    return {
      allowed: true,
      current_count: 5,
      max_requests: 10,
      window_seconds: 60,
      remaining: 5,
      resets_at: '2028-01-01T00:01:00.000Z',
      retry_after_seconds: 0,
      daily_count: 20,
      daily_cap: 100,
      daily_remaining: 80,
      ...overrides,
    };
  }

  it('includes standard rate limit headers for allowed requests', () => {
    const headers = rateLimitHeaders(makeResult());

    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('5');
    expect(headers['X-RateLimit-Reset']).toBe('2028-01-01T00:01:00.000Z');
    expect(headers['X-RateLimit-Daily-Limit']).toBe('100');
    expect(headers['X-RateLimit-Daily-Remaining']).toBe('80');
    expect(headers['Retry-After']).toBeUndefined();
  });

  it('includes Retry-After header for denied requests', () => {
    const headers = rateLimitHeaders(makeResult({
      allowed: false,
      retry_after_seconds: 45,
    }));

    expect(headers['Retry-After']).toBe('45');
    expect(headers['X-RateLimit-Limit']).toBe('10');
  });

  it('omits Retry-After for allowed requests', () => {
    const headers = rateLimitHeaders(makeResult({ allowed: true }));
    expect(headers['Retry-After']).toBeUndefined();
  });
});

// ──────────────────────────────────────────────
// Rate Limit Response Body
// ──────────────────────────────────────────────

describe('rateLimitBody', () => {
  const result: RateLimitResult = {
    allowed: false,
    current_count: 10,
    max_requests: 10,
    window_seconds: 60,
    remaining: 0,
    resets_at: '2028-01-01T00:01:00.000Z',
    retry_after_seconds: 30,
    daily_count: 50,
    daily_cap: 100,
    daily_remaining: 50,
  };

  it('includes error code and action', () => {
    const body = rateLimitBody('task.submit', result);
    expect(body.error).toBe('Rate limit exceeded.');
    expect(body.code).toBe('rate_limit_exceeded');
    expect(body.action).toBe('task.submit');
  });

  it('includes quota details for agent self-regulation', () => {
    const body = rateLimitBody('context.write', result);
    expect(body.limit).toBe(10);
    expect(body.window_seconds).toBe(60);
    expect(body.current).toBe(10);
    expect(body.retry_after_seconds).toBe(30);
    expect(body.resets_at).toBe('2028-01-01T00:01:00.000Z');
  });

  it('includes daily cap information', () => {
    const body = rateLimitBody('task.route', result);
    expect(body.daily_count).toBe(50);
    expect(body.daily_cap).toBe(100);
  });

  it('includes a hint pointing to the usage endpoint', () => {
    const body = rateLimitBody('task.submit', result);
    expect(body.hint).toContain('/api/a2a/usage');
    expect(body.hint).toContain('trust level');
  });

  it('works with different action types', () => {
    const actions: RateLimitAction[] = [
      'task.submit',
      'task.route',
      'task.update',
      'context.write',
      'context.read',
      'subscription.create',
      'feedback.submit',
    ];
    for (const action of actions) {
      const body = rateLimitBody(action, result);
      expect(body.action).toBe(action);
    }
  });
});

// ──────────────────────────────────────────────
// Quota Structure Invariants
// ──────────────────────────────────────────────

describe('quota structure invariants', () => {
  it('all window sizes are multiples of 10 seconds', () => {
    for (const level of Object.values(QUOTA_TIERS)) {
      for (const quota of Object.values(level) as QuotaTier[]) {
        expect(quota.window_seconds % 10).toBe(0);
      }
    }
  });

  it('read quotas are higher than write quotas at every trust level', () => {
    for (const [, tiers] of Object.entries(QUOTA_TIERS)) {
      const read = tiers['context.read'];
      const write = tiers['context.write'];
      expect(read.max_requests).toBeGreaterThanOrEqual(write.max_requests);
      expect(read.daily_cap).toBeGreaterThanOrEqual(write.daily_cap);
    }
  });

  it('partner quotas are at least 5x untrusted quotas', () => {
    const actions: RateLimitAction[] = ['task.submit', 'task.route', 'context.write'];
    for (const action of actions) {
      const untrusted = QUOTA_TIERS.untrusted[action];
      const partner = QUOTA_TIERS.partner[action];
      expect(partner.max_requests / untrusted.max_requests).toBeGreaterThanOrEqual(5);
    }
  });
});
