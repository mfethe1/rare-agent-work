/**
 * Tests for A2A Event Streaming System
 *
 * Covers: topic matching, data filter evaluation, event filter matching,
 * validation, retry delay computation, and webhook signatures.
 */

import { describe, it, expect } from 'vitest';
import {
  topicMatchesPattern,
  evaluateDataFilter,
  eventMatchesFilter,
  computeWebhookSignature,
  verifyWebhookSignature,
  computeRetryDelay,
} from '@/lib/a2a/events/engine';
import {
  validateEmitEventParams,
  validateCreateSubscription,
  validateStatusTransition,
  validateReplayRequest,
} from '@/lib/a2a/events/validation';
import {
  A2AEvent,
  EventFilter,
  RetryPolicy,
} from '@/lib/a2a/events/types';

// ---------------------------------------------------------------------------
// Topic Matching
// ---------------------------------------------------------------------------

describe('topicMatchesPattern', () => {
  it('matches exact topic', () => {
    expect(topicMatchesPattern('task.completed', 'task.completed')).toBe(true);
  });

  it('does not match different topic', () => {
    expect(topicMatchesPattern('task.completed', 'task.failed')).toBe(false);
  });

  it('matches wildcard action', () => {
    expect(topicMatchesPattern('task.completed', 'task.*')).toBe(true);
    expect(topicMatchesPattern('task.failed', 'task.*')).toBe(true);
  });

  it('matches wildcard domain', () => {
    expect(topicMatchesPattern('task.completed', '*.completed')).toBe(true);
    expect(topicMatchesPattern('contract.completed', '*.completed')).toBe(true);
  });

  it('matches universal wildcard', () => {
    expect(topicMatchesPattern('task.completed', '*.*')).toBe(true);
    expect(topicMatchesPattern('anything.here', '*.*')).toBe(true);
  });

  it('does not match partial strings', () => {
    expect(topicMatchesPattern('task.completed', 'tas.*')).toBe(false);
    expect(topicMatchesPattern('task.completed', '*.complete')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Data Filter Evaluation
// ---------------------------------------------------------------------------

describe('evaluateDataFilter', () => {
  const data = { priority: 5, name: 'test-agent', tags: ['fast', 'gpu'], nested: { value: 42 } };

  it('evaluates "eq" operator', () => {
    expect(evaluateDataFilter(data, { path: 'priority', operator: 'eq', value: 5 })).toBe(true);
    expect(evaluateDataFilter(data, { path: 'priority', operator: 'eq', value: 3 })).toBe(false);
  });

  it('evaluates "neq" operator', () => {
    expect(evaluateDataFilter(data, { path: 'priority', operator: 'neq', value: 3 })).toBe(true);
    expect(evaluateDataFilter(data, { path: 'priority', operator: 'neq', value: 5 })).toBe(false);
  });

  it('evaluates numeric comparisons', () => {
    expect(evaluateDataFilter(data, { path: 'priority', operator: 'gt', value: 3 })).toBe(true);
    expect(evaluateDataFilter(data, { path: 'priority', operator: 'gt', value: 5 })).toBe(false);
    expect(evaluateDataFilter(data, { path: 'priority', operator: 'gte', value: 5 })).toBe(true);
    expect(evaluateDataFilter(data, { path: 'priority', operator: 'lt', value: 10 })).toBe(true);
    expect(evaluateDataFilter(data, { path: 'priority', operator: 'lte', value: 5 })).toBe(true);
  });

  it('evaluates "exists" operator', () => {
    expect(evaluateDataFilter(data, { path: 'priority', operator: 'exists' })).toBe(true);
    expect(evaluateDataFilter(data, { path: 'missing', operator: 'exists' })).toBe(false);
  });

  it('evaluates "contains" on strings', () => {
    expect(evaluateDataFilter(data, { path: 'name', operator: 'contains', value: 'agent' })).toBe(true);
    expect(evaluateDataFilter(data, { path: 'name', operator: 'contains', value: 'nope' })).toBe(false);
  });

  it('evaluates "contains" on arrays', () => {
    expect(evaluateDataFilter(data, { path: 'tags', operator: 'contains', value: 'fast' })).toBe(true);
    expect(evaluateDataFilter(data, { path: 'tags', operator: 'contains', value: 'slow' })).toBe(false);
  });

  it('evaluates "in" operator', () => {
    expect(evaluateDataFilter(data, { path: 'priority', operator: 'in', value: [3, 5, 7] })).toBe(true);
    expect(evaluateDataFilter(data, { path: 'priority', operator: 'in', value: [1, 2, 3] })).toBe(false);
  });

  it('handles nested paths', () => {
    expect(evaluateDataFilter(data, { path: 'nested.value', operator: 'eq', value: 42 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Event Filter Matching
// ---------------------------------------------------------------------------

describe('eventMatchesFilter', () => {
  const baseEvent: A2AEvent = {
    id: 'evt-001',
    sequence: 1,
    timestamp: '2028-01-01T00:00:00Z',
    topic: 'task.completed',
    domain: 'task',
    action: 'completed',
    source_agent_id: 'agent-a',
    resource_id: 'task-001',
    resource_type: 'task',
    correlation_id: null,
    trace_context: null,
    data: { duration_ms: 500, priority: 8 },
    schema_version: '1.0.0',
    idempotency_key: 'task.completed:task-001:1',
  };

  it('matches by topic pattern', () => {
    const filter: EventFilter = { topics: ['task.*'] };
    expect(eventMatchesFilter(baseEvent, filter)).toBe(true);
  });

  it('rejects non-matching topic', () => {
    const filter: EventFilter = { topics: ['contract.*'] };
    expect(eventMatchesFilter(baseEvent, filter)).toBe(false);
  });

  it('filters by source_agent_id', () => {
    const filter: EventFilter = { topics: ['*.*'], source_agent_ids: ['agent-a'] };
    expect(eventMatchesFilter(baseEvent, filter)).toBe(true);

    const filter2: EventFilter = { topics: ['*.*'], source_agent_ids: ['agent-b'] };
    expect(eventMatchesFilter(baseEvent, filter2)).toBe(false);
  });

  it('filters by resource_id', () => {
    const filter: EventFilter = { topics: ['*.*'], resource_ids: ['task-001'] };
    expect(eventMatchesFilter(baseEvent, filter)).toBe(true);
  });

  it('filters by resource_type', () => {
    const filter: EventFilter = { topics: ['*.*'], resource_types: ['task'] };
    expect(eventMatchesFilter(baseEvent, filter)).toBe(true);
  });

  it('filters by domain', () => {
    const filter: EventFilter = { topics: ['*.*'], domains: ['task'] };
    expect(eventMatchesFilter(baseEvent, filter)).toBe(true);

    const filter2: EventFilter = { topics: ['*.*'], domains: ['contract'] };
    expect(eventMatchesFilter(baseEvent, filter2)).toBe(false);
  });

  it('applies data_filters', () => {
    const filter: EventFilter = {
      topics: ['task.*'],
      data_filters: [{ path: 'priority', operator: 'gte', value: 5 }],
    };
    expect(eventMatchesFilter(baseEvent, filter)).toBe(true);

    const filter2: EventFilter = {
      topics: ['task.*'],
      data_filters: [{ path: 'priority', operator: 'gte', value: 10 }],
    };
    expect(eventMatchesFilter(baseEvent, filter2)).toBe(false);
  });

  it('requires all data_filters to match (AND)', () => {
    const filter: EventFilter = {
      topics: ['task.*'],
      data_filters: [
        { path: 'priority', operator: 'gte', value: 5 },
        { path: 'duration_ms', operator: 'lt', value: 1000 },
      ],
    };
    expect(eventMatchesFilter(baseEvent, filter)).toBe(true);

    const filter2: EventFilter = {
      topics: ['task.*'],
      data_filters: [
        { path: 'priority', operator: 'gte', value: 5 },
        { path: 'duration_ms', operator: 'lt', value: 100 }, // fails
      ],
    };
    expect(eventMatchesFilter(baseEvent, filter2)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Webhook Signature
// ---------------------------------------------------------------------------

describe('webhook signatures', () => {
  const body = '{"event":"test"}';
  const timestamp = '2028-01-01T00:00:00Z';
  const secret = 'super-secret-key-1234';

  it('computes and verifies signature', () => {
    const sig = computeWebhookSignature(body, timestamp, secret);
    expect(sig.algorithm).toBe('hmac-sha256');
    expect(sig.signature).toHaveLength(64); // SHA-256 hex
    expect(verifyWebhookSignature(body, timestamp, sig.signature, secret)).toBe(true);
  });

  it('rejects tampered body', () => {
    const sig = computeWebhookSignature(body, timestamp, secret);
    expect(verifyWebhookSignature('{"event":"tampered"}', timestamp, sig.signature, secret)).toBe(false);
  });

  it('rejects wrong secret', () => {
    const sig = computeWebhookSignature(body, timestamp, secret);
    expect(verifyWebhookSignature(body, timestamp, sig.signature, 'wrong-secret')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Retry Delay Computation
// ---------------------------------------------------------------------------

describe('computeRetryDelay', () => {
  const policy: RetryPolicy = {
    max_attempts: 5,
    initial_delay_ms: 1000,
    backoff_multiplier: 2,
    max_delay_ms: 30_000,
    jitter_factor: 0, // deterministic for testing
  };

  it('computes exponential backoff', () => {
    expect(computeRetryDelay(1, policy)).toBe(1000);
    expect(computeRetryDelay(2, policy)).toBe(2000);
    expect(computeRetryDelay(3, policy)).toBe(4000);
    expect(computeRetryDelay(4, policy)).toBe(8000);
  });

  it('caps at max_delay_ms', () => {
    expect(computeRetryDelay(10, policy)).toBe(30_000);
  });

  it('adds jitter when configured', () => {
    const withJitter: RetryPolicy = { ...policy, jitter_factor: 0.5 };
    const delay = computeRetryDelay(1, withJitter);
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThanOrEqual(1500);
  });
});

// ---------------------------------------------------------------------------
// Validation — Emit Event
// ---------------------------------------------------------------------------

describe('validateEmitEventParams', () => {
  const valid = {
    domain: 'task' as const,
    action: 'completed',
    resource_id: 'task-001',
    resource_type: 'task',
    data: { result: 'ok' },
  };

  it('passes valid params', () => {
    expect(validateEmitEventParams(valid).valid).toBe(true);
  });

  it('rejects missing domain', () => {
    const result = validateEmitEventParams({ ...valid, domain: '' as never });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid domain', () => {
    const result = validateEmitEventParams({ ...valid, domain: 'invalid' as never });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid action format', () => {
    const result = validateEmitEventParams({ ...valid, action: 'Bad-Action!' });
    expect(result.valid).toBe(false);
  });

  it('rejects missing resource_id', () => {
    const result = validateEmitEventParams({ ...valid, resource_id: '' });
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Validation — Create Subscription
// ---------------------------------------------------------------------------

describe('validateCreateSubscription', () => {
  const valid = {
    agent_id: 'agent-001',
    name: 'Task Watcher',
    delivery: {
      method: 'webhook' as const,
      webhook_url: 'https://example.com/webhook',
      webhook_secret: 'my-secret-key-12345678',
      timeout_ms: 5000,
      batch_size: 1,
      batch_window_ms: 0,
    },
    filter: {
      topics: ['task.*'],
    },
  };

  it('passes valid params', () => {
    expect(validateCreateSubscription(valid).valid).toBe(true);
  });

  it('rejects empty topics', () => {
    const result = validateCreateSubscription({ ...valid, filter: { topics: [] } });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid topic pattern', () => {
    const result = validateCreateSubscription({ ...valid, filter: { topics: ['bad'] } });
    expect(result.valid).toBe(false);
  });

  it('rejects webhook without URL', () => {
    const result = validateCreateSubscription({
      ...valid,
      delivery: { ...valid.delivery, webhook_url: undefined },
    });
    expect(result.valid).toBe(false);
  });

  it('rejects short webhook secret', () => {
    const result = validateCreateSubscription({
      ...valid,
      delivery: { ...valid.delivery, webhook_secret: 'short' },
    });
    expect(result.valid).toBe(false);
  });

  it('allows SSE without URL', () => {
    const sseValid = {
      ...valid,
      delivery: {
        method: 'sse' as const,
        timeout_ms: 5000,
        batch_size: 1,
        batch_window_ms: 0,
      },
    };
    expect(validateCreateSubscription(sseValid).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Validation — Status Transitions
// ---------------------------------------------------------------------------

describe('validateStatusTransition', () => {
  it('allows active → paused', () => {
    expect(validateStatusTransition('active', 'paused').valid).toBe(true);
  });

  it('allows paused → active', () => {
    expect(validateStatusTransition('paused', 'active').valid).toBe(true);
  });

  it('rejects cancelled → active', () => {
    expect(validateStatusTransition('cancelled', 'active').valid).toBe(false);
  });

  it('allows suspended → active', () => {
    expect(validateStatusTransition('suspended', 'active').valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Validation — Replay Request
// ---------------------------------------------------------------------------

describe('validateReplayRequest', () => {
  it('passes valid replay', () => {
    const result = validateReplayRequest({
      subscription_id: 'sub-001',
      from_sequence: 0,
      limit: 100,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects negative from_sequence', () => {
    const result = validateReplayRequest({
      subscription_id: 'sub-001',
      from_sequence: -1,
      limit: 100,
    });
    expect(result.valid).toBe(false);
  });

  it('rejects limit > 1000', () => {
    const result = validateReplayRequest({
      subscription_id: 'sub-001',
      from_sequence: 0,
      limit: 5000,
    });
    expect(result.valid).toBe(false);
  });

  it('rejects to_sequence < from_sequence', () => {
    const result = validateReplayRequest({
      subscription_id: 'sub-001',
      from_sequence: 100,
      to_sequence: 50,
      limit: 100,
    });
    expect(result.valid).toBe(false);
  });
});
