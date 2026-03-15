/**
 * Zod validation schemas for A2A Observability & Tracing endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);
const hexString = (len: number) =>
  z.string().regex(new RegExp(`^[0-9a-f]{${len}}$`), `Must be ${len}-char hex string`);

// ──────────────────────────────────────────────
// Trace Context (for propagation)
// ──────────────────────────────────────────────

export const traceContextSchema = z.object({
  trace_id: hexString(32),
  span_id: hexString(16),
  trace_flags: z.number().int().min(0).max(255).default(1),
  trace_state: trimmed(512).optional(),
});

export type TraceContextInput = z.infer<typeof traceContextSchema>;

// ──────────────────────────────────────────────
// Start Trace — POST /api/a2a/traces
// ──────────────────────────────────────────────

export const traceStartSchema = z.object({
  operation: trimmed(200).min(1, 'operation name is required'),
  kind: z.enum(['internal', 'client', 'server', 'producer', 'consumer']).default('internal'),
  attributes: z.record(z.string(), z.unknown()).default({}),
  parent_context: traceContextSchema.optional(),
});

export type TraceStartInput = z.infer<typeof traceStartSchema>;

// ──────────────────────────────────────────────
// Create Span — POST /api/a2a/traces/:traceId/spans
// ──────────────────────────────────────────────

const spanLinkSchema = z.object({
  trace_id: hexString(32),
  span_id: hexString(16),
  relationship: z.enum(['caused_by', 'follows_from', 'related_to']),
  attributes: z.record(z.string(), z.unknown()).default({}),
});

export const spanCreateSchema = z.object({
  parent_span_id: hexString(16),
  operation: trimmed(200).min(1, 'operation name is required'),
  kind: z.enum(['internal', 'client', 'server', 'producer', 'consumer']).default('internal'),
  attributes: z.record(z.string(), z.unknown()).default({}),
  links: z.array(spanLinkSchema).max(32).default([]),
});

export type SpanCreateInput = z.infer<typeof spanCreateSchema>;

// ──────────────────────────────────────────────
// Update Span — PATCH /api/a2a/traces/:traceId/spans/:spanId
// ──────────────────────────────────────────────

const spanEventSchema = z.object({
  name: trimmed(200).min(1),
  attributes: z.record(z.string(), z.unknown()).default({}),
});

export const spanUpdateSchema = z.object({
  status: z.enum(['unset', 'ok', 'error']).optional(),
  error_message: trimmed(2000).optional(),
  error_code: trimmed(100).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  events: z.array(spanEventSchema).max(100).optional(),
  end: z.boolean().optional(),
});

export type SpanUpdateInput = z.infer<typeof spanUpdateSchema>;

// ──────────────────────────────────────────────
// List Traces — GET /api/a2a/traces
// ──────────────────────────────────────────────

export const traceListSchema = z.object({
  agent_id: z.string().uuid().optional(),
  operation: trimmed(200).optional(),
  has_errors: z.boolean().optional(),
  min_duration_ms: z.number().int().min(0).optional(),
  max_duration_ms: z.number().int().min(0).optional(),
  started_after: z.string().datetime().optional(),
  started_before: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type TraceListInput = z.infer<typeof traceListSchema>;

// ──────────────────────────────────────────────
// Metrics Query — GET /api/a2a/metrics
// ──────────────────────────────────────────────

export const metricsQuerySchema = z.object({
  metric: trimmed(200).min(1, 'metric name is required'),
  agent_id: z.string().uuid().optional(),
  granularity: z.enum(['1m', '5m', '15m', '1h', '6h', '1d']).default('5m'),
  started_after: z.string().datetime(),
  started_before: z.string().datetime(),
  tags: z.record(z.string(), z.string()).default({}),
});

export type MetricsQueryInput = z.infer<typeof metricsQuerySchema>;

// ──────────────────────────────────────────────
// Record Metric — POST /api/a2a/metrics
// ──────────────────────────────────────────────

export const metricRecordSchema = z.object({
  metric: trimmed(200).min(1, 'metric name is required'),
  value: z.number(),
  tags: z.record(z.string(), z.string()).default({}),
});

export type MetricRecordInput = z.infer<typeof metricRecordSchema>;

// ──────────────────────────────────────────────
// Anomaly Query — GET /api/a2a/anomalies
// ──────────────────────────────────────────────

export const anomalyListSchema = z.object({
  agent_id: z.string().uuid().optional(),
  type: z
    .enum([
      'latency_spike',
      'error_burst',
      'throughput_drop',
      'agent_degradation',
      'cascade_failure',
      'sla_risk',
      'cost_anomaly',
    ])
    .optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  is_active: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type AnomalyListInput = z.infer<typeof anomalyListSchema>;

// ──────────────────────────────────────────────
// Agent Performance — GET /api/a2a/observability/agents/:id
// ──────────────────────────────────────────────

export const agentPerformanceSchema = z.object({
  window_hours: z.number().int().min(1).max(720).default(24),
});

export type AgentPerformanceInput = z.infer<typeof agentPerformanceSchema>;
