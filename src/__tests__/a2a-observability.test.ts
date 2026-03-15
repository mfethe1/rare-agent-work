/**
 * Tests for A2A Distributed Tracing & Observability
 *
 * Covers:
 * - Trace context encoding/decoding (W3C traceparent)
 * - ID generation format
 * - Metric aggregation with percentiles
 * - Anomaly detection via z-score analysis
 * - Validation schemas
 */

import { describe, it, expect } from 'vitest';
import {
  generateTraceId,
  generateSpanId,
  encodeTraceparent,
  decodeTraceparent,
  aggregateIntoBuckets,
  percentile,
  standardDeviation,
} from '@/lib/a2a/observability';
import {
  traceStartSchema,
  spanCreateSchema,
  spanUpdateSchema,
  traceListSchema,
  metricsQuerySchema,
  metricRecordSchema,
  anomalyListSchema,
  agentPerformanceSchema,
  traceContextSchema,
} from '@/lib/a2a/observability';
import { A2A_METRICS } from '@/lib/a2a/observability';

// ──────────────────────────────────────────────
// ID Generation
// ──────────────────────────────────────────────

describe('generateTraceId', () => {
  it('produces a 32-character hex string', () => {
    const id = generateTraceId();
    expect(id).toHaveLength(32);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('produces unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTraceId()));
    expect(ids.size).toBe(100);
  });
});

describe('generateSpanId', () => {
  it('produces a 16-character hex string', () => {
    const id = generateSpanId();
    expect(id).toHaveLength(16);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('produces unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSpanId()));
    expect(ids.size).toBe(100);
  });
});

// ──────────────────────────────────────────────
// W3C Trace Context Propagation
// ──────────────────────────────────────────────

describe('encodeTraceparent', () => {
  it('encodes a trace context to W3C traceparent format', () => {
    const ctx = {
      trace_id: '0af7651916cd43dd8448eb211c80319c',
      span_id: 'b7ad6b7169203331',
      trace_flags: 1,
    };
    expect(encodeTraceparent(ctx)).toBe(
      '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    );
  });

  it('encodes zero trace flags correctly', () => {
    const ctx = {
      trace_id: 'aaaabbbbccccddddeeeeffffaaaabbbb',
      span_id: '1122334455667788',
      trace_flags: 0,
    };
    expect(encodeTraceparent(ctx)).toBe(
      '00-aaaabbbbccccddddeeeeffffaaaabbbb-1122334455667788-00',
    );
  });
});

describe('decodeTraceparent', () => {
  it('decodes a valid traceparent header', () => {
    const header = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
    const ctx = decodeTraceparent(header);
    expect(ctx).toEqual({
      trace_id: '0af7651916cd43dd8448eb211c80319c',
      span_id: 'b7ad6b7169203331',
      trace_flags: 1,
    });
  });

  it('returns null for malformed headers', () => {
    expect(decodeTraceparent('')).toBeNull();
    expect(decodeTraceparent('invalid')).toBeNull();
    expect(decodeTraceparent('01-abc-def-01')).toBeNull(); // wrong version
    expect(decodeTraceparent('00-short-short-01')).toBeNull(); // wrong lengths
  });

  it('rejects non-hex characters', () => {
    expect(
      decodeTraceparent('00-ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ-b7ad6b7169203331-01'),
    ).toBeNull();
  });

  it('roundtrips with encodeTraceparent', () => {
    const original = {
      trace_id: generateTraceId(),
      span_id: generateSpanId(),
      trace_flags: 1,
    };
    const encoded = encodeTraceparent(original);
    const decoded = decodeTraceparent(encoded);
    expect(decoded).toEqual(original);
  });
});

// ──────────────────────────────────────────────
// Percentile Calculation
// ──────────────────────────────────────────────

describe('percentile', () => {
  it('returns the single value for a 1-element array', () => {
    expect(percentile([42], 0.5)).toBe(42);
    expect(percentile([42], 0.99)).toBe(42);
  });

  it('returns 0 for empty array', () => {
    expect(percentile([], 0.5)).toBe(0);
  });

  it('computes p50 correctly', () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentile(sorted, 0.5)).toBe(3);
  });

  it('interpolates between values', () => {
    const sorted = [10, 20, 30, 40];
    const p75 = percentile(sorted, 0.75);
    // idx = 0.75 * 3 = 2.25 → lerp(30, 40, 0.25) = 32.5
    expect(p75).toBeCloseTo(32.5);
  });

  it('computes p95 for a larger dataset', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    const p95 = percentile(sorted, 0.95);
    expect(p95).toBeCloseTo(95.05, 1);
  });

  it('p0 returns min, p100 returns max', () => {
    const sorted = [5, 10, 15, 20, 25];
    expect(percentile(sorted, 0)).toBe(5);
    expect(percentile(sorted, 1)).toBe(25);
  });
});

// ──────────────────────────────────────────────
// Standard Deviation
// ──────────────────────────────────────────────

describe('standardDeviation', () => {
  it('returns 0 for single value', () => {
    expect(standardDeviation([5])).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(standardDeviation([])).toBe(0);
  });

  it('computes correctly for known values', () => {
    // Population: [2, 4, 4, 4, 5, 5, 7, 9] → sample std ≈ 2.138
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const std = standardDeviation(values);
    expect(std).toBeCloseTo(2.138, 2);
  });

  it('returns 0 for identical values', () => {
    expect(standardDeviation([3, 3, 3, 3])).toBe(0);
  });
});

// ──────────────────────────────────────────────
// Metric Aggregation
// ──────────────────────────────────────────────

describe('aggregateIntoBuckets', () => {
  const baseTime = new Date('2026-03-14T12:00:00Z').getTime();

  function makePoints(values: number[], intervalMs = 30_000) {
    return values.map((v, i) => ({
      metric: 'test.latency',
      value: v,
      recorded_at: new Date(baseTime + i * intervalMs).toISOString(),
      tags: { agent: 'test-agent' },
    }));
  }

  it('aggregates into 1m buckets', () => {
    // 6 points at 30s intervals = 3 minutes
    const points = makePoints([10, 20, 30, 40, 50, 60]);
    const agg = aggregateIntoBuckets(points, 'test.latency', '1m');

    expect(agg.length).toBe(3);
    // First bucket: [10, 20]
    expect(agg[0].count).toBe(2);
    expect(agg[0].avg).toBe(15);
    expect(agg[0].min).toBe(10);
    expect(agg[0].max).toBe(20);
  });

  it('computes percentiles within buckets', () => {
    // 10 points in a single 5m bucket
    const points = makePoints([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 10_000);
    const agg = aggregateIntoBuckets(points, 'test.latency', '5m');

    expect(agg.length).toBe(1);
    expect(agg[0].p50).toBe(5.5);
    expect(agg[0].p95).toBeCloseTo(9.55, 1);
    expect(agg[0].p99).toBeCloseTo(9.91, 1);
  });

  it('returns empty for empty input', () => {
    expect(aggregateIntoBuckets([], 'test', '5m')).toEqual([]);
  });

  it('filters by tags', () => {
    const points = [
      { metric: 'test', value: 100, recorded_at: new Date(baseTime).toISOString(), tags: { agent: 'a' } },
      { metric: 'test', value: 200, recorded_at: new Date(baseTime + 1000).toISOString(), tags: { agent: 'b' } },
      { metric: 'test', value: 300, recorded_at: new Date(baseTime + 2000).toISOString(), tags: { agent: 'a' } },
    ];

    const agg = aggregateIntoBuckets(points, 'test', '5m', { agent: 'a' });
    expect(agg.length).toBe(1);
    expect(agg[0].count).toBe(2);
    expect(agg[0].avg).toBe(200);
  });

  it('sorts buckets chronologically', () => {
    const points = [
      { metric: 'test', value: 1, recorded_at: new Date(baseTime + 600_000).toISOString(), tags: {} },
      { metric: 'test', value: 2, recorded_at: new Date(baseTime).toISOString(), tags: {} },
    ];

    const agg = aggregateIntoBuckets(points, 'test', '5m');
    expect(agg.length).toBe(2);
    expect(new Date(agg[0].window_start).getTime()).toBeLessThan(
      new Date(agg[1].window_start).getTime(),
    );
  });
});

// ──────────────────────────────────────────────
// A2A_METRICS Constants
// ──────────────────────────────────────────────

describe('A2A_METRICS', () => {
  it('defines all expected metric names', () => {
    expect(A2A_METRICS.TASK_LATENCY).toBe('a2a.task.latency_ms');
    expect(A2A_METRICS.TASK_COMPLETED).toBe('a2a.task.completed');
    expect(A2A_METRICS.ROUTE_LATENCY).toBe('a2a.route.latency_ms');
    expect(A2A_METRICS.AGENT_ERROR_RATE).toBe('a2a.agent.error_rate');
    expect(A2A_METRICS.WORKFLOW_DURATION).toBe('a2a.workflow.duration_ms');
    expect(A2A_METRICS.SETTLEMENT_AMOUNT).toBe('a2a.billing.settlement_amount');
  });

  it('uses consistent naming convention (a2a.domain.metric)', () => {
    for (const value of Object.values(A2A_METRICS)) {
      expect(value).toMatch(/^a2a\.\w+\.\w+/);
    }
  });
});

// ──────────────────────────────────────────────
// Validation Schemas
// ──────────────────────────────────────────────

describe('traceContextSchema', () => {
  it('accepts valid trace context', () => {
    const result = traceContextSchema.safeParse({
      trace_id: '0af7651916cd43dd8448eb211c80319c',
      span_id: 'b7ad6b7169203331',
      trace_flags: 1,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid hex strings', () => {
    const result = traceContextSchema.safeParse({
      trace_id: 'not-hex-at-all!!',
      span_id: 'also-invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('traceStartSchema', () => {
  it('accepts valid trace start request', () => {
    const result = traceStartSchema.safeParse({
      operation: 'task.submit',
      kind: 'client',
      attributes: { intent: 'news.query', priority: 'high' },
    });
    expect(result.success).toBe(true);
  });

  it('provides defaults for kind and attributes', () => {
    const result = traceStartSchema.safeParse({ operation: 'test.op' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe('internal');
      expect(result.data.attributes).toEqual({});
    }
  });

  it('rejects empty operation', () => {
    const result = traceStartSchema.safeParse({ operation: '' });
    expect(result.success).toBe(false);
  });

  it('accepts parent context for trace continuation', () => {
    const result = traceStartSchema.safeParse({
      operation: 'workflow.step',
      parent_context: {
        trace_id: 'aaaabbbbccccddddeeeeffffaaaabbbb',
        span_id: '1122334455667788',
        trace_flags: 1,
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('spanCreateSchema', () => {
  it('accepts valid span creation', () => {
    const result = spanCreateSchema.safeParse({
      parent_span_id: 'abcdef0123456789',
      operation: 'db.query',
      kind: 'client',
    });
    expect(result.success).toBe(true);
  });

  it('accepts links to related spans', () => {
    const result = spanCreateSchema.safeParse({
      parent_span_id: 'abcdef0123456789',
      operation: 'process.result',
      links: [
        {
          trace_id: 'aaaabbbbccccddddeeeeffffaaaabbbb',
          span_id: '1122334455667788',
          relationship: 'caused_by',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('limits links to 32', () => {
    const links = Array.from({ length: 33 }, () => ({
      trace_id: 'aaaabbbbccccddddeeeeffffaaaabbbb',
      span_id: '1122334455667788',
      relationship: 'related_to' as const,
    }));
    const result = spanCreateSchema.safeParse({
      parent_span_id: 'abcdef0123456789',
      operation: 'test',
      links,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid parent_span_id format', () => {
    const result = spanCreateSchema.safeParse({
      parent_span_id: 'too-short',
      operation: 'test',
    });
    expect(result.success).toBe(false);
  });
});

describe('spanUpdateSchema', () => {
  it('accepts end with status', () => {
    const result = spanUpdateSchema.safeParse({
      status: 'ok',
      end: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts error details', () => {
    const result = spanUpdateSchema.safeParse({
      status: 'error',
      error_message: 'Agent timeout',
      error_code: 'TIMEOUT',
      end: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts events', () => {
    const result = spanUpdateSchema.safeParse({
      events: [
        { name: 'cache_hit', attributes: { key: 'agent-123' } },
        { name: 'retry', attributes: { attempt: 2 } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('limits events to 100', () => {
    const events = Array.from({ length: 101 }, (_, i) => ({ name: `event-${i}` }));
    const result = spanUpdateSchema.safeParse({ events });
    expect(result.success).toBe(false);
  });
});

describe('traceListSchema', () => {
  it('accepts all filter parameters', () => {
    const result = traceListSchema.safeParse({
      agent_id: '550e8400-e29b-41d4-a716-446655440000',
      operation: 'task.submit',
      has_errors: true,
      min_duration_ms: 100,
      max_duration_ms: 5000,
      started_after: '2026-03-14T00:00:00Z',
      started_before: '2026-03-14T23:59:59Z',
      limit: 25,
      offset: 0,
    });
    expect(result.success).toBe(true);
  });

  it('provides defaults for limit and offset', () => {
    const result = traceListSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(0);
    }
  });

  it('clamps limit to 100', () => {
    const result = traceListSchema.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });
});

describe('metricsQuerySchema', () => {
  it('accepts valid metrics query', () => {
    const result = metricsQuerySchema.safeParse({
      metric: 'a2a.task.latency_ms',
      started_after: '2026-03-14T00:00:00Z',
      started_before: '2026-03-14T23:59:59Z',
      granularity: '1h',
    });
    expect(result.success).toBe(true);
  });

  it('defaults granularity to 5m', () => {
    const result = metricsQuerySchema.safeParse({
      metric: 'test',
      started_after: '2026-03-14T00:00:00Z',
      started_before: '2026-03-14T23:59:59Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.granularity).toBe('5m');
    }
  });

  it('rejects empty metric name', () => {
    const result = metricsQuerySchema.safeParse({
      metric: '',
      started_after: '2026-03-14T00:00:00Z',
      started_before: '2026-03-14T23:59:59Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('metricRecordSchema', () => {
  it('accepts valid metric recording', () => {
    const result = metricRecordSchema.safeParse({
      metric: 'a2a.task.latency_ms',
      value: 42.5,
      tags: { agent_id: 'abc', intent: 'news.query' },
    });
    expect(result.success).toBe(true);
  });

  it('defaults tags to empty object', () => {
    const result = metricRecordSchema.safeParse({
      metric: 'test',
      value: 100,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual({});
    }
  });
});

describe('anomalyListSchema', () => {
  it('accepts all filter parameters', () => {
    const result = anomalyListSchema.safeParse({
      agent_id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'latency_spike',
      severity: 'critical',
      is_active: true,
      limit: 10,
    });
    expect(result.success).toBe(true);
  });

  it('validates anomaly types', () => {
    const result = anomalyListSchema.safeParse({ type: 'invalid_type' });
    expect(result.success).toBe(false);
  });
});

describe('agentPerformanceSchema', () => {
  it('defaults window to 24 hours', () => {
    const result = agentPerformanceSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.window_hours).toBe(24);
    }
  });

  it('clamps window to 720 hours (30 days)', () => {
    const result = agentPerformanceSchema.safeParse({ window_hours: 1000 });
    expect(result.success).toBe(false);
  });
});
