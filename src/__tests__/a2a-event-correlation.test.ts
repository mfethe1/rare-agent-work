/**
 * Tests for the A2A Event Correlation & Causal Tracing Engine
 *
 * Validates causal graph construction, timeline generation, and the
 * core matching/filtering logic that enables agents to trace operations
 * across subsystems.
 */

import {
  topicMatchesPattern,
  evaluateDataFilter,
  eventMatchesFilter,
  computeRetryDelay,
  computeWebhookSignature,
  verifyWebhookSignature,
  DEFAULT_RETRY_POLICY,
} from '@/lib/a2a/events';

// ---------------------------------------------------------------------------
// Topic Matching
// ---------------------------------------------------------------------------

describe('topicMatchesPattern', () => {
  it('matches exact topics', () => {
    expect(topicMatchesPattern('task.completed', 'task.completed')).toBe(true);
    expect(topicMatchesPattern('task.completed', 'task.failed')).toBe(false);
  });

  it('matches domain wildcards', () => {
    expect(topicMatchesPattern('task.completed', 'task.*')).toBe(true);
    expect(topicMatchesPattern('task.failed', 'task.*')).toBe(true);
    expect(topicMatchesPattern('contract.completed', 'task.*')).toBe(false);
  });

  it('matches action wildcards', () => {
    expect(topicMatchesPattern('task.completed', '*.completed')).toBe(true);
    expect(topicMatchesPattern('contract.completed', '*.completed')).toBe(true);
    expect(topicMatchesPattern('task.failed', '*.completed')).toBe(false);
  });

  it('matches global wildcard', () => {
    expect(topicMatchesPattern('task.completed', '*.*')).toBe(true);
    expect(topicMatchesPattern('billing.charge', '*.*')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Data Filter Evaluation
// ---------------------------------------------------------------------------

describe('evaluateDataFilter', () => {
  const data = {
    amount: 100,
    status: 'active',
    tags: ['urgent', 'billing'],
    nested: { value: 42 },
  };

  it('evaluates eq operator', () => {
    expect(evaluateDataFilter(data, { path: 'status', operator: 'eq', value: 'active' })).toBe(true);
    expect(evaluateDataFilter(data, { path: 'status', operator: 'eq', value: 'inactive' })).toBe(false);
  });

  it('evaluates neq operator', () => {
    expect(evaluateDataFilter(data, { path: 'status', operator: 'neq', value: 'inactive' })).toBe(true);
  });

  it('evaluates numeric comparisons', () => {
    expect(evaluateDataFilter(data, { path: 'amount', operator: 'gt', value: 50 })).toBe(true);
    expect(evaluateDataFilter(data, { path: 'amount', operator: 'lt', value: 50 })).toBe(false);
    expect(evaluateDataFilter(data, { path: 'amount', operator: 'gte', value: 100 })).toBe(true);
    expect(evaluateDataFilter(data, { path: 'amount', operator: 'lte', value: 100 })).toBe(true);
  });

  it('evaluates exists operator', () => {
    expect(evaluateDataFilter(data, { path: 'amount', operator: 'exists' })).toBe(true);
    expect(evaluateDataFilter(data, { path: 'missing', operator: 'exists' })).toBe(false);
  });

  it('evaluates contains operator for arrays', () => {
    expect(evaluateDataFilter(data, { path: 'tags', operator: 'contains', value: 'urgent' })).toBe(true);
    expect(evaluateDataFilter(data, { path: 'tags', operator: 'contains', value: 'other' })).toBe(false);
  });

  it('evaluates contains operator for strings', () => {
    expect(evaluateDataFilter(data, { path: 'status', operator: 'contains', value: 'act' })).toBe(true);
  });

  it('evaluates in operator', () => {
    expect(evaluateDataFilter(data, { path: 'status', operator: 'in', value: ['active', 'pending'] })).toBe(true);
    expect(evaluateDataFilter(data, { path: 'status', operator: 'in', value: ['closed'] })).toBe(false);
  });

  it('evaluates nested paths', () => {
    expect(evaluateDataFilter(data, { path: 'nested.value', operator: 'eq', value: 42 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Event Filter Matching
// ---------------------------------------------------------------------------

describe('eventMatchesFilter', () => {
  const event = {
    id: 'evt-1',
    sequence: 1,
    timestamp: '2028-01-01T00:00:00Z',
    topic: 'task.completed',
    domain: 'task',
    action: 'completed',
    source_agent_id: 'agent-a',
    resource_id: 'task-001',
    resource_type: 'task',
    correlation_id: 'corr-001',
    trace_context: null,
    data: { duration_ms: 500 },
    schema_version: '1.0.0',
    idempotency_key: 'task.completed:task-001:1',
  };

  it('matches by topic pattern', () => {
    expect(eventMatchesFilter(event, { topics: ['task.*'] })).toBe(true);
    expect(eventMatchesFilter(event, { topics: ['contract.*'] })).toBe(false);
  });

  it('filters by domain', () => {
    expect(eventMatchesFilter(event, { topics: ['*.*'], domains: ['task'] })).toBe(true);
    expect(eventMatchesFilter(event, { topics: ['*.*'], domains: ['billing'] })).toBe(false);
  });

  it('filters by source agent', () => {
    expect(eventMatchesFilter(event, {
      topics: ['*.*'],
      source_agent_ids: ['agent-a'],
    })).toBe(true);
    expect(eventMatchesFilter(event, {
      topics: ['*.*'],
      source_agent_ids: ['agent-b'],
    })).toBe(false);
  });

  it('filters by resource ID', () => {
    expect(eventMatchesFilter(event, {
      topics: ['*.*'],
      resource_ids: ['task-001'],
    })).toBe(true);
    expect(eventMatchesFilter(event, {
      topics: ['*.*'],
      resource_ids: ['task-999'],
    })).toBe(false);
  });

  it('filters by data predicate', () => {
    expect(eventMatchesFilter(event, {
      topics: ['*.*'],
      data_filters: [{ path: 'duration_ms', operator: 'lt', value: 1000 }],
    })).toBe(true);
    expect(eventMatchesFilter(event, {
      topics: ['*.*'],
      data_filters: [{ path: 'duration_ms', operator: 'gt', value: 1000 }],
    })).toBe(false);
  });

  it('requires all data filters to match (AND semantics)', () => {
    expect(eventMatchesFilter(event, {
      topics: ['*.*'],
      data_filters: [
        { path: 'duration_ms', operator: 'lt', value: 1000 },
        { path: 'duration_ms', operator: 'gt', value: 100 },
      ],
    })).toBe(true);
    expect(eventMatchesFilter(event, {
      topics: ['*.*'],
      data_filters: [
        { path: 'duration_ms', operator: 'lt', value: 1000 },
        { path: 'duration_ms', operator: 'gt', value: 600 },
      ],
    })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Retry Delay Computation
// ---------------------------------------------------------------------------

describe('computeRetryDelay', () => {
  it('computes exponential backoff', () => {
    const policy = { ...DEFAULT_RETRY_POLICY, jitter_factor: 0 };
    expect(computeRetryDelay(1, policy)).toBe(1000);
    expect(computeRetryDelay(2, policy)).toBe(2000);
    expect(computeRetryDelay(3, policy)).toBe(4000);
  });

  it('caps at max delay', () => {
    const policy = { ...DEFAULT_RETRY_POLICY, jitter_factor: 0, max_delay_ms: 3000 };
    expect(computeRetryDelay(10, policy)).toBe(3000);
  });

  it('adds jitter within bounds', () => {
    const policy = { ...DEFAULT_RETRY_POLICY, jitter_factor: 0.5 };
    const delays = Array.from({ length: 100 }, () => computeRetryDelay(1, policy));
    expect(delays.every((d) => d >= 1000 && d <= 1500)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Webhook Signature
// ---------------------------------------------------------------------------

describe('webhook signature', () => {
  it('computes and verifies HMAC-SHA256 signature', () => {
    const body = '{"event":"test"}';
    const timestamp = '2028-01-01T00:00:00Z';
    const secret = 'my-super-secret-key-1234';

    const sig = computeWebhookSignature(body, timestamp, secret);
    expect(sig.algorithm).toBe('hmac-sha256');
    expect(sig.signature).toMatch(/^[a-f0-9]{64}$/);

    expect(verifyWebhookSignature(body, timestamp, sig.signature, secret)).toBe(true);
    expect(verifyWebhookSignature(body, timestamp, sig.signature, 'wrong-secret')).toBe(false);
    expect(verifyWebhookSignature('tampered', timestamp, sig.signature, secret)).toBe(false);
  });
});
