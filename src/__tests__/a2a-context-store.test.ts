import { describe, expect, it } from 'vitest';
import { contextStoreSchema, contextQuerySchema } from '@/lib/a2a/validation';
import { matchesPattern, subscriptionMatchesEvent, ALL_EVENT_TYPES, EVENT_DOMAINS } from '@/lib/a2a/webhooks';

// ──────────────────────────────────────────────
// Context Store Validation
// ──────────────────────────────────────────────

describe('contextStoreSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = contextStoreSchema.safeParse({
      key: 'market_analysis',
      value: { summary: 'AI spending up 40% YoY' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.namespace).toBe('default');
      expect(result.data.ttl_seconds).toBe(3600);
      expect(result.data.content_type).toBe('application/json');
    }
  });

  it('accepts a fully specified payload', () => {
    const result = contextStoreSchema.safeParse({
      namespace: 'research',
      key: 'competitor_analysis_q1',
      value: { findings: ['point1', 'point2'], confidence: 0.92 },
      correlation_id: 'workflow-abc-123',
      task_id: '550e8400-e29b-41d4-a716-446655440000',
      content_type: 'application/json+research',
      ttl_seconds: 86400,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.namespace).toBe('research');
      expect(result.data.ttl_seconds).toBe(86400);
    }
  });

  it('rejects missing key', () => {
    const result = contextStoreSchema.safeParse({
      value: { data: 'test' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing value', () => {
    const result = contextStoreSchema.safeParse({
      key: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects TTL below 60 seconds', () => {
    const result = contextStoreSchema.safeParse({
      key: 'test',
      value: { data: 'test' },
      ttl_seconds: 30,
    });
    expect(result.success).toBe(false);
  });

  it('rejects TTL above 7 days (604800s)', () => {
    const result = contextStoreSchema.safeParse({
      key: 'test',
      value: { data: 'test' },
      ttl_seconds: 604801,
    });
    expect(result.success).toBe(false);
  });

  it('rejects value over 64KB', () => {
    const largeValue: Record<string, string> = {};
    // Create a payload that exceeds 64KB
    for (let i = 0; i < 700; i++) {
      largeValue[`key_${i}`] = 'x'.repeat(100);
    }
    const result = contextStoreSchema.safeParse({
      key: 'test',
      value: largeValue,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty key', () => {
    const result = contextStoreSchema.safeParse({
      key: '',
      value: { data: 'test' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid task_id format', () => {
    const result = contextStoreSchema.safeParse({
      key: 'test',
      value: { data: 'test' },
      task_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('trims whitespace from string fields', () => {
    const result = contextStoreSchema.safeParse({
      key: '  trimmed_key  ',
      namespace: '  research  ',
      value: { data: 'test' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.key).toBe('trimmed_key');
      expect(result.data.namespace).toBe('research');
    }
  });
});

// ──────────────────────────────────────────────
// Context Query Validation
// ──────────────────────────────────────────────

describe('contextQuerySchema', () => {
  it('accepts empty query (returns all)', () => {
    const result = contextQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it('accepts namespace filter', () => {
    const result = contextQuerySchema.safeParse({ namespace: 'research' });
    expect(result.success).toBe(true);
  });

  it('accepts correlation_id filter', () => {
    const result = contextQuerySchema.safeParse({ correlation_id: 'workflow-123' });
    expect(result.success).toBe(true);
  });

  it('accepts combined filters', () => {
    const result = contextQuerySchema.safeParse({
      namespace: 'decisions',
      correlation_id: 'workflow-xyz',
      agent_id: '550e8400-e29b-41d4-a716-446655440000',
      key_prefix: 'market_',
      limit: 25,
    });
    expect(result.success).toBe(true);
  });

  it('rejects limit below 1', () => {
    const result = contextQuerySchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects limit above 100', () => {
    const result = contextQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid agent_id format', () => {
    const result = contextQuerySchema.safeParse({ agent_id: 'not-uuid' });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Context Event Integration
// ──────────────────────────────────────────────

describe('context webhook events', () => {
  it('includes context.stored in ALL_EVENT_TYPES', () => {
    expect(ALL_EVENT_TYPES).toContain('context.stored');
  });

  it('includes context in EVENT_DOMAINS', () => {
    expect(EVENT_DOMAINS).toContain('context');
  });

  it('matches context.stored with exact pattern', () => {
    expect(matchesPattern('context.stored', 'context.stored')).toBe(true);
  });

  it('matches context.stored with context.* wildcard', () => {
    expect(matchesPattern('context.stored', 'context.*')).toBe(true);
  });

  it('matches context.stored with global wildcard', () => {
    expect(matchesPattern('context.stored', '*')).toBe(true);
  });

  it('does not match context.stored with task.*', () => {
    expect(matchesPattern('context.stored', 'task.*')).toBe(false);
  });

  it('subscriptionMatchesEvent works for context events', () => {
    expect(subscriptionMatchesEvent(['context.*'], 'context.stored')).toBe(true);
    expect(subscriptionMatchesEvent(['task.*'], 'context.stored')).toBe(false);
    expect(subscriptionMatchesEvent(['*'], 'context.stored')).toBe(true);
  });
});
