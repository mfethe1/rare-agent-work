/**
 * A2A Distributed Tracing & Observability Engine
 *
 * Provides:
 * - Distributed trace creation with W3C-compatible context propagation
 * - Span lifecycle management (create → annotate → end)
 * - Metric recording and aggregation
 * - Statistical anomaly detection (z-score based)
 * - Agent performance summaries
 * - System health dashboard
 */

import { randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  TraceId,
  SpanId,
  TraceSpan,
  Trace,
  TraceContext,
  SpanStatus,
  SpanKind,
  SpanLink,
  MetricDataPoint,
  MetricAggregate,
  MetricGranularity,
  Anomaly,
  AnomalySeverity,
  AnomalyType,
  AgentPerformanceSummary,
  SystemHealthResponse,
} from './types';

// ──────────────────────────────────────────────
// ID Generation
// ──────────────────────────────────────────────

/** Generate a 128-bit trace ID (32 hex chars). */
export function generateTraceId(): TraceId {
  return randomBytes(16).toString('hex');
}

/** Generate a 64-bit span ID (16 hex chars). */
export function generateSpanId(): SpanId {
  return randomBytes(8).toString('hex');
}

// ──────────────────────────────────────────────
// Trace Context Propagation
// ──────────────────────────────────────────────

/**
 * Encode a TraceContext into a W3C traceparent header value.
 * Format: {version}-{trace_id}-{span_id}-{trace_flags}
 */
export function encodeTraceparent(ctx: TraceContext): string {
  const flags = ctx.trace_flags.toString(16).padStart(2, '0');
  return `00-${ctx.trace_id}-${ctx.span_id}-${flags}`;
}

/**
 * Decode a W3C traceparent header into a TraceContext.
 * Returns null if the header is malformed.
 */
export function decodeTraceparent(header: string): TraceContext | null {
  const parts = header.split('-');
  if (parts.length < 4) return null;
  const [version, traceId, spanId, flags] = parts;
  if (version !== '00') return null;
  if (traceId.length !== 32 || spanId.length !== 16) return null;
  if (!/^[0-9a-f]+$/.test(traceId) || !/^[0-9a-f]+$/.test(spanId)) return null;
  return {
    trace_id: traceId,
    span_id: spanId,
    trace_flags: parseInt(flags, 16),
  };
}

// ──────────────────────────────────────────────
// Trace & Span Lifecycle
// ──────────────────────────────────────────────

/**
 * Start a new distributed trace with a root span.
 */
export async function startTrace(
  db: SupabaseClient,
  agentId: string,
  operation: string,
  kind: SpanKind = 'internal',
  attributes: Record<string, string | number | boolean> = {},
  parentContext?: TraceContext,
): Promise<{ trace_id: TraceId; root_span_id: SpanId; context: TraceContext }> {
  const traceId = parentContext?.trace_id ?? generateTraceId();
  const rootSpanId = generateSpanId();
  const now = new Date().toISOString();

  const span: Omit<TraceSpan, 'events' | 'links'> = {
    span_id: rootSpanId,
    trace_id: traceId,
    parent_span_id: parentContext?.span_id ?? null,
    operation,
    kind,
    agent_id: agentId,
    status: 'unset',
    attributes,
    started_at: now,
    ended_at: null,
    duration_ms: null,
  };

  const { error } = await db.from('a2a_spans').insert({
    span_id: span.span_id,
    trace_id: span.trace_id,
    parent_span_id: span.parent_span_id,
    operation: span.operation,
    kind: span.kind,
    agent_id: span.agent_id,
    status: span.status,
    attributes: span.attributes,
    events: [],
    links: [],
    started_at: span.started_at,
    ended_at: null,
    duration_ms: null,
  });

  if (error) throw new Error(`Failed to start trace: ${error.message}`);

  const context: TraceContext = {
    trace_id: traceId,
    span_id: rootSpanId,
    trace_flags: 1, // sampled
  };

  return { trace_id: traceId, root_span_id: rootSpanId, context };
}

/**
 * Create a child span within an existing trace.
 */
export async function createSpan(
  db: SupabaseClient,
  traceId: TraceId,
  parentSpanId: SpanId,
  agentId: string,
  operation: string,
  kind: SpanKind = 'internal',
  attributes: Record<string, string | number | boolean> = {},
  links: SpanLink[] = [],
): Promise<{ span_id: SpanId; context: TraceContext }> {
  const spanId = generateSpanId();
  const now = new Date().toISOString();

  const { error } = await db.from('a2a_spans').insert({
    span_id: spanId,
    trace_id: traceId,
    parent_span_id: parentSpanId,
    operation,
    kind,
    agent_id: agentId,
    status: 'unset',
    attributes,
    events: [],
    links,
    started_at: now,
    ended_at: null,
    duration_ms: null,
  });

  if (error) throw new Error(`Failed to create span: ${error.message}`);

  return {
    span_id: spanId,
    context: { trace_id: traceId, span_id: spanId, trace_flags: 1 },
  };
}

/**
 * End a span, setting its status and computing duration.
 */
export async function endSpan(
  db: SupabaseClient,
  traceId: TraceId,
  spanId: SpanId,
  status: SpanStatus = 'ok',
  errorMessage?: string,
  errorCode?: string,
): Promise<{ duration_ms: number }> {
  // Fetch the span to compute duration
  const { data: span, error: fetchError } = await db
    .from('a2a_spans')
    .select('started_at')
    .eq('span_id', spanId)
    .eq('trace_id', traceId)
    .single();

  if (fetchError || !span) throw new Error('Span not found');

  const now = new Date();
  const startedAt = new Date(span.started_at);
  const durationMs = now.getTime() - startedAt.getTime();

  const update: Record<string, unknown> = {
    status,
    ended_at: now.toISOString(),
    duration_ms: durationMs,
  };
  if (errorMessage) update.error_message = errorMessage;
  if (errorCode) update.error_code = errorCode;

  const { error } = await db
    .from('a2a_spans')
    .update(update)
    .eq('span_id', spanId)
    .eq('trace_id', traceId);

  if (error) throw new Error(`Failed to end span: ${error.message}`);

  return { duration_ms: durationMs };
}

/**
 * Add events or attributes to an active span.
 */
export async function annotateSpan(
  db: SupabaseClient,
  traceId: TraceId,
  spanId: SpanId,
  opts: {
    attributes?: Record<string, string | number | boolean>;
    events?: Array<{ name: string; attributes?: Record<string, string | number | boolean> }>;
    status?: SpanStatus;
    error_message?: string;
    error_code?: string;
  },
): Promise<void> {
  // Fetch current span data
  const { data: span, error: fetchError } = await db
    .from('a2a_spans')
    .select('attributes, events, status')
    .eq('span_id', spanId)
    .eq('trace_id', traceId)
    .single();

  if (fetchError || !span) throw new Error('Span not found');

  const update: Record<string, unknown> = {};

  if (opts.attributes) {
    update.attributes = { ...span.attributes, ...opts.attributes };
  }

  if (opts.events) {
    const now = new Date().toISOString();
    const newEvents = opts.events.map((e) => ({
      name: e.name,
      timestamp: now,
      attributes: e.attributes ?? {},
    }));
    update.events = [...(span.events || []), ...newEvents];
  }

  if (opts.status) update.status = opts.status;
  if (opts.error_message) update.error_message = opts.error_message;
  if (opts.error_code) update.error_code = opts.error_code;

  if (Object.keys(update).length === 0) return;

  const { error } = await db
    .from('a2a_spans')
    .update(update)
    .eq('span_id', spanId)
    .eq('trace_id', traceId);

  if (error) throw new Error(`Failed to annotate span: ${error.message}`);
}

// ──────────────────────────────────────────────
// Trace Retrieval
// ──────────────────────────────────────────────

/**
 * Get a full trace with all its spans.
 */
export async function getTrace(db: SupabaseClient, traceId: TraceId): Promise<Trace | null> {
  const { data: spans, error } = await db
    .from('a2a_spans')
    .select('*')
    .eq('trace_id', traceId)
    .order('started_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch trace: ${error.message}`);
  if (!spans || spans.length === 0) return null;

  return assembleTrace(traceId, spans);
}

/**
 * List traces matching filter criteria.
 */
export async function listTraces(
  db: SupabaseClient,
  filters: {
    agent_id?: string;
    operation?: string;
    has_errors?: boolean;
    min_duration_ms?: number;
    max_duration_ms?: number;
    started_after?: string;
    started_before?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ traces: Trace[]; count: number }> {
  // First, get distinct trace IDs matching filters from root spans
  let query = db
    .from('a2a_spans')
    .select('trace_id, started_at', { count: 'exact' })
    .is('parent_span_id', null); // root spans only

  if (filters.agent_id) query = query.eq('agent_id', filters.agent_id);
  if (filters.operation) query = query.eq('operation', filters.operation);
  if (filters.has_errors === true) query = query.eq('status', 'error');
  if (filters.min_duration_ms != null) query = query.gte('duration_ms', filters.min_duration_ms);
  if (filters.max_duration_ms != null) query = query.lte('duration_ms', filters.max_duration_ms);
  if (filters.started_after) query = query.gte('started_at', filters.started_after);
  if (filters.started_before) query = query.lte('started_at', filters.started_before);

  query = query
    .order('started_at', { ascending: false })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1);

  const { data: rootSpans, error, count } = await query;
  if (error) throw new Error(`Failed to list traces: ${error.message}`);
  if (!rootSpans || rootSpans.length === 0) return { traces: [], count: 0 };

  // Fetch full spans for each trace
  const traceIds = rootSpans.map((s: { trace_id: string }) => s.trace_id);
  const { data: allSpans, error: spanError } = await db
    .from('a2a_spans')
    .select('*')
    .in('trace_id', traceIds)
    .order('started_at', { ascending: true });

  if (spanError) throw new Error(`Failed to fetch trace spans: ${spanError.message}`);

  // Group spans by trace and assemble
  const spansByTrace = new Map<string, unknown[]>();
  for (const span of allSpans || []) {
    const existing = spansByTrace.get(span.trace_id) ?? [];
    existing.push(span);
    spansByTrace.set(span.trace_id, existing);
  }

  const traces: Trace[] = [];
  for (const tid of traceIds) {
    const spans = spansByTrace.get(tid);
    if (spans && spans.length > 0) {
      traces.push(assembleTrace(tid, spans));
    }
  }

  return { traces, count: count ?? traces.length };
}

/**
 * Assemble a Trace object from raw span rows.
 */
function assembleTrace(traceId: string, spans: unknown[]): Trace {
  const typedSpans = spans as TraceSpan[];
  const rootSpan = typedSpans.find((s) => s.parent_span_id === null) ?? typedSpans[0];
  const agentIds = new Set(typedSpans.map((s) => s.agent_id));
  const hasErrors = typedSpans.some((s) => s.status === 'error');

  const startTimes = typedSpans.map((s) => new Date(s.started_at).getTime());
  const endTimes = typedSpans
    .filter((s) => s.ended_at)
    .map((s) => new Date(s.ended_at!).getTime());

  const earliestStart = Math.min(...startTimes);
  const latestEnd = endTimes.length > 0 ? Math.max(...endTimes) : null;

  return {
    trace_id: traceId,
    root_operation: rootSpan.operation,
    initiator_agent_id: rootSpan.agent_id,
    spans: typedSpans,
    span_count: typedSpans.length,
    duration_ms: latestEnd ? latestEnd - earliestStart : 0,
    has_errors: hasErrors,
    agent_count: agentIds.size,
    started_at: new Date(earliestStart).toISOString(),
    ended_at: latestEnd ? new Date(latestEnd).toISOString() : null,
  };
}

// ──────────────────────────────────────────────
// Metrics
// ──────────────────────────────────────────────

/**
 * Record a metric data point.
 */
export async function recordMetric(
  db: SupabaseClient,
  agentId: string,
  metric: string,
  value: number,
  tags: Record<string, string> = {},
): Promise<void> {
  const { error } = await db.from('a2a_metrics').insert({
    agent_id: agentId,
    metric,
    value,
    tags,
    recorded_at: new Date().toISOString(),
  });

  if (error) throw new Error(`Failed to record metric: ${error.message}`);
}

/**
 * Query aggregated metrics over a time window.
 */
export async function queryMetrics(
  db: SupabaseClient,
  metric: string,
  startedAfter: string,
  startedBefore: string,
  granularity: MetricGranularity = '5m',
  filters: { agent_id?: string; tags?: Record<string, string> } = {},
): Promise<MetricAggregate[]> {
  let query = db
    .from('a2a_metrics')
    .select('*')
    .eq('metric', metric)
    .gte('recorded_at', startedAfter)
    .lte('recorded_at', startedBefore)
    .order('recorded_at', { ascending: true });

  if (filters.agent_id) query = query.eq('agent_id', filters.agent_id);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to query metrics: ${error.message}`);
  if (!data || data.length === 0) return [];

  // Aggregate into time buckets
  return aggregateIntoBuckets(
    data as Array<{ metric: string; value: number; recorded_at: string; tags: Record<string, string> }>,
    metric,
    granularity,
    filters.tags,
  );
}

/** Granularity → milliseconds mapping. */
const GRANULARITY_MS: Record<MetricGranularity, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '6h': 21_600_000,
  '1d': 86_400_000,
};

/**
 * Aggregate raw data points into time-bucketed aggregates with percentiles.
 */
export function aggregateIntoBuckets(
  dataPoints: Array<{ metric: string; value: number; recorded_at: string; tags: Record<string, string> }>,
  metric: string,
  granularity: MetricGranularity,
  tagFilter?: Record<string, string>,
): MetricAggregate[] {
  const bucketMs = GRANULARITY_MS[granularity];

  // Filter by tags if specified
  let filtered = dataPoints;
  if (tagFilter && Object.keys(tagFilter).length > 0) {
    filtered = dataPoints.filter((dp) =>
      Object.entries(tagFilter).every(([k, v]) => dp.tags[k] === v),
    );
  }

  if (filtered.length === 0) return [];

  // Group into buckets
  const buckets = new Map<number, number[]>();
  for (const dp of filtered) {
    const ts = new Date(dp.recorded_at).getTime();
    const bucketStart = Math.floor(ts / bucketMs) * bucketMs;
    const existing = buckets.get(bucketStart) ?? [];
    existing.push(dp.value);
    buckets.set(bucketStart, existing);
  }

  // Compute aggregates per bucket
  const aggregates: MetricAggregate[] = [];
  for (const [bucketStart, values] of buckets.entries()) {
    values.sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    aggregates.push({
      metric,
      tags: tagFilter ?? {},
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      sum,
      avg: sum / values.length,
      p50: percentile(values, 0.5),
      p95: percentile(values, 0.95),
      p99: percentile(values, 0.99),
      window_start: new Date(bucketStart).toISOString(),
      window_end: new Date(bucketStart + bucketMs).toISOString(),
    });
  }

  return aggregates.sort(
    (a, b) => new Date(a.window_start).getTime() - new Date(b.window_start).getTime(),
  );
}

/**
 * Compute a percentile from a sorted array of numbers.
 */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

// ──────────────────────────────────────────────
// Anomaly Detection
// ──────────────────────────────────────────────

/**
 * Detect anomalies using z-score analysis on recent metrics.
 * Compares the most recent window against a rolling baseline.
 *
 * @param baselineWindows Number of prior windows to use as baseline (default: 20)
 * @param zThreshold Z-score threshold for anomaly detection (default: 2.5)
 */
export async function detectAnomalies(
  db: SupabaseClient,
  metric: string,
  agentId: string | undefined,
  baselineWindows = 20,
  zThreshold = 2.5,
): Promise<Anomaly[]> {
  const now = new Date();
  const windowMs = GRANULARITY_MS['5m'];
  const baselineStart = new Date(now.getTime() - windowMs * (baselineWindows + 1));

  let query = db
    .from('a2a_metrics')
    .select('*')
    .eq('metric', metric)
    .gte('recorded_at', baselineStart.toISOString())
    .order('recorded_at', { ascending: true });

  if (agentId) query = query.eq('agent_id', agentId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch metric data: ${error.message}`);
  if (!data || data.length < 5) return []; // Not enough data

  const values = data.map((d: { value: number }) => d.value);
  const recentCutoff = now.getTime() - windowMs;
  const baselineValues = data
    .filter((d: { recorded_at: string }) => new Date(d.recorded_at).getTime() < recentCutoff)
    .map((d: { value: number }) => d.value);
  const recentValues = data
    .filter((d: { recorded_at: string }) => new Date(d.recorded_at).getTime() >= recentCutoff)
    .map((d: { value: number }) => d.value);

  if (baselineValues.length < 3 || recentValues.length === 0) return [];

  const baselineMean = baselineValues.reduce((a: number, b: number) => a + b, 0) / baselineValues.length;
  const baselineStd = standardDeviation(baselineValues);

  if (baselineStd === 0) return []; // No variance → can't detect anomalies

  const recentMean = recentValues.reduce((a: number, b: number) => a + b, 0) / recentValues.length;
  const zScore = Math.abs(recentMean - baselineMean) / baselineStd;

  if (zScore < zThreshold) return [];

  const anomaly: Anomaly = {
    id: generateSpanId() + generateSpanId(), // 32 hex chars
    type: classifyAnomaly(metric, recentMean, baselineMean),
    severity: classifySeverity(zScore),
    description: `${metric}: observed ${recentMean.toFixed(2)} vs expected ${baselineMean.toFixed(2)} (${zScore.toFixed(1)}σ deviation)`,
    affected_agent_ids: agentId ? [agentId] : extractUniqueAgentIds(data),
    related_trace_ids: [],
    metric,
    observed_value: recentMean,
    expected_value: baselineMean,
    deviation: zScore,
    is_active: true,
    detected_at: now.toISOString(),
    resolved_at: null,
  };

  // Persist the anomaly
  await db.from('a2a_anomalies').insert(anomaly);

  return [anomaly];
}

/**
 * List anomalies matching filter criteria.
 */
export async function listAnomalies(
  db: SupabaseClient,
  filters: {
    agent_id?: string;
    type?: AnomalyType;
    severity?: AnomalySeverity;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<{ anomalies: Anomaly[]; count: number }> {
  let query = db.from('a2a_anomalies').select('*', { count: 'exact' });

  if (filters.agent_id) query = query.contains('affected_agent_ids', [filters.agent_id]);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.severity) query = query.eq('severity', filters.severity);
  if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);

  query = query
    .order('detected_at', { ascending: false })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to list anomalies: ${error.message}`);

  return { anomalies: (data as Anomaly[]) ?? [], count: count ?? 0 };
}

/**
 * Compute standard deviation of a number array.
 */
export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1));
}

function classifyAnomaly(metric: string, observed: number, expected: number): AnomalyType {
  if (metric.includes('latency') || metric.includes('response_time')) return 'latency_spike';
  if (metric.includes('error')) return 'error_burst';
  if (metric.includes('throughput') && observed < expected) return 'throughput_drop';
  if (metric.includes('cost') || metric.includes('settlement') || metric.includes('spend'))
    return 'cost_anomaly';
  if (metric.includes('breach') || metric.includes('sla')) return 'sla_risk';
  return 'agent_degradation';
}

function classifySeverity(zScore: number): AnomalySeverity {
  if (zScore >= 4.0) return 'critical';
  if (zScore >= 3.0) return 'warning';
  return 'info';
}

function extractUniqueAgentIds(data: Array<{ agent_id: string }>): string[] {
  return [...new Set(data.map((d) => d.agent_id))];
}

// ──────────────────────────────────────────────
// Agent Performance Summary
// ──────────────────────────────────────────────

/**
 * Compute a performance summary for an agent over a time window.
 */
export async function getAgentPerformance(
  db: SupabaseClient,
  agentId: string,
  windowHours = 24,
): Promise<AgentPerformanceSummary | null> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowHours * 3_600_000);

  // Fetch agent info
  const { data: agent } = await db
    .from('agent_registry')
    .select('id, name')
    .eq('id', agentId)
    .single();

  if (!agent) return null;

  // Fetch spans for this agent in the window
  const { data: spans } = await db
    .from('a2a_spans')
    .select('operation, status, duration_ms, started_at')
    .eq('agent_id', agentId)
    .gte('started_at', windowStart.toISOString())
    .not('ended_at', 'is', null);

  const completedSpans = (spans ?? []) as Array<{
    operation: string;
    status: string;
    duration_ms: number;
    started_at: string;
  }>;

  const tasksCompleted = completedSpans.filter((s) => s.status === 'ok').length;
  const tasksFailed = completedSpans.filter((s) => s.status === 'error').length;
  const total = tasksCompleted + tasksFailed;
  const successRate = total > 0 ? tasksCompleted / total : 1;
  const errorRate = total > 0 ? tasksFailed / total : 0;

  const durations = completedSpans
    .map((s) => s.duration_ms)
    .filter((d): d is number => d != null)
    .sort((a, b) => a - b);

  const avgLatency = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const throughputPerHour = total > 0 ? total / (windowHours || 1) : 0;

  // Count active anomalies for this agent
  const { count: anomalyCount } = await db
    .from('a2a_anomalies')
    .select('id', { count: 'exact', head: true })
    .contains('affected_agent_ids', [agentId])
    .eq('is_active', true);

  const activeAnomalies = anomalyCount ?? 0;

  let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (activeAnomalies > 0 || errorRate > 0.1) health = 'degraded';
  if (activeAnomalies > 2 || errorRate > 0.3) health = 'unhealthy';

  return {
    agent_id: agentId,
    agent_name: agent.name,
    window_start: windowStart.toISOString(),
    window_end: now.toISOString(),
    tasks_completed: tasksCompleted,
    tasks_failed: tasksFailed,
    success_rate: successRate,
    avg_latency_ms: avgLatency,
    p50_latency_ms: durations.length > 0 ? percentile(durations, 0.5) : 0,
    p95_latency_ms: durations.length > 0 ? percentile(durations, 0.95) : 0,
    p99_latency_ms: durations.length > 0 ? percentile(durations, 0.99) : 0,
    error_rate: errorRate,
    throughput_per_hour: throughputPerHour,
    active_anomalies: activeAnomalies,
    health,
  };
}

// ──────────────────────────────────────────────
// System Health Dashboard
// ──────────────────────────────────────────────

/**
 * Generate a system-wide health snapshot.
 */
export async function getSystemHealth(db: SupabaseClient): Promise<SystemHealthResponse> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3_600_000);

  // Active traces (spans started in last hour without ended_at)
  const { count: activeTraceCount } = await db
    .from('a2a_spans')
    .select('trace_id', { count: 'exact', head: true })
    .is('parent_span_id', null)
    .is('ended_at', null)
    .gte('started_at', oneHourAgo.toISOString());

  // Active anomalies
  const { data: activeAnomalies } = await db
    .from('a2a_anomalies')
    .select('*')
    .eq('is_active', true);

  const anomalyCount = activeAnomalies?.length ?? 0;

  // Task metrics for last hour
  const { data: recentSpans } = await db
    .from('a2a_spans')
    .select('agent_id, status, duration_ms')
    .gte('started_at', oneHourAgo.toISOString())
    .not('ended_at', 'is', null);

  const spans = (recentSpans ?? []) as Array<{
    agent_id: string;
    status: string;
    duration_ms: number;
  }>;

  const totalTasks = spans.length;
  const errorCount = spans.filter((s) => s.status === 'error').length;
  const durations = spans.map((s) => s.duration_ms).filter((d): d is number => d != null);
  const avgLatency = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const activeAgents = new Set(spans.map((s) => s.agent_id)).size;
  const errorRate = totalTasks > 0 ? errorCount / totalTasks : 0;

  // Determine overall health
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (anomalyCount > 0 || errorRate > 0.05) status = 'degraded';
  if (anomalyCount > 3 || errorRate > 0.2) status = 'unhealthy';

  // Per-agent summaries for active agents
  const uniqueAgentIds = [...new Set(spans.map((s) => s.agent_id))];
  const agents: AgentPerformanceSummary[] = [];
  for (const aid of uniqueAgentIds.slice(0, 20)) {
    const perf = await getAgentPerformance(db, aid, 1);
    if (perf) agents.push(perf);
  }

  return {
    status,
    active_traces: activeTraceCount ?? 0,
    active_anomalies: anomalyCount,
    agents,
    system_metrics: {
      total_tasks_last_hour: totalTasks,
      avg_latency_ms: avgLatency,
      error_rate: errorRate,
      active_agents: activeAgents,
    },
    generated_at: now.toISOString(),
  };
}
