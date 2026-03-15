/**
 * A2A Distributed Tracing & Observability Types
 *
 * Implements OpenTelemetry-compatible distributed tracing for multi-agent
 * workflows. Every agent interaction creates spans that form traces,
 * enabling end-to-end visibility across the entire A2A ecosystem.
 *
 * In 2028's agent-operated world, observability is the difference between
 * a debuggable system and a black box.
 */

// ──────────────────────────────────────────────
// Trace & Span Core
// ──────────────────────────────────────────────

/** 128-bit trace ID (hex string, 32 chars). */
export type TraceId = string;

/** 64-bit span ID (hex string, 16 chars). */
export type SpanId = string;

/** Span status matching OpenTelemetry conventions. */
export type SpanStatus = 'unset' | 'ok' | 'error';

/** Span kind following OpenTelemetry semantic conventions. */
export type SpanKind =
  | 'internal'    // Default: internal operation
  | 'client'      // Outgoing request to another agent
  | 'server'      // Incoming request from another agent
  | 'producer'    // Async message send (task submission, webhook)
  | 'consumer';   // Async message receive (task pickup)

/**
 * A single unit of work within a distributed trace.
 * Spans form a tree within a trace, with parent-child relationships.
 */
export interface TraceSpan {
  /** Unique span identifier. */
  span_id: SpanId;
  /** Trace this span belongs to. */
  trace_id: TraceId;
  /** Parent span (null for root spans). */
  parent_span_id: SpanId | null;
  /** Human-readable operation name (e.g., "task.submit", "route.evaluate"). */
  operation: string;
  /** Semantic span kind. */
  kind: SpanKind;
  /** Agent that created this span. */
  agent_id: string;
  /** Current span status. */
  status: SpanStatus;
  /** Error message if status is 'error'. */
  error_message?: string;
  /** Error code if status is 'error'. */
  error_code?: string;
  /** Structured attributes (key-value metadata). */
  attributes: Record<string, string | number | boolean>;
  /** Timestamped events that occurred during this span. */
  events: SpanEvent[];
  /** Links to related spans in other traces. */
  links: SpanLink[];
  /** Start time (ISO-8601). */
  started_at: string;
  /** End time (ISO-8601, null if still active). */
  ended_at: string | null;
  /** Duration in milliseconds (computed on end). */
  duration_ms: number | null;
}

/** A timestamped event within a span. */
export interface SpanEvent {
  /** Event name (e.g., "exception", "retry", "cache_hit"). */
  name: string;
  /** When the event occurred (ISO-8601). */
  timestamp: string;
  /** Structured event attributes. */
  attributes: Record<string, string | number | boolean>;
}

/** Link to a causally related span (cross-trace correlation). */
export interface SpanLink {
  /** Trace ID of the linked span. */
  trace_id: TraceId;
  /** Span ID of the linked span. */
  span_id: SpanId;
  /** Why these spans are linked. */
  relationship: 'caused_by' | 'follows_from' | 'related_to';
  /** Additional link attributes. */
  attributes: Record<string, string | number | boolean>;
}

// ──────────────────────────────────────────────
// Trace Context Propagation
// ──────────────────────────────────────────────

/**
 * W3C Trace Context for propagation across agent boundaries.
 * Agents include this in task submissions, API calls, and messages
 * to maintain trace continuity.
 */
export interface TraceContext {
  /** Active trace ID. */
  trace_id: TraceId;
  /** Current span ID (becomes parent of next span). */
  span_id: SpanId;
  /** Trace flags (sampled, etc.). */
  trace_flags: number;
  /** Vendor-specific trace state. */
  trace_state?: string;
}

// ──────────────────────────────────────────────
// Aggregated Trace View
// ──────────────────────────────────────────────

/** A complete trace: all spans for a single end-to-end operation. */
export interface Trace {
  /** Trace identifier. */
  trace_id: TraceId;
  /** Root span operation name. */
  root_operation: string;
  /** Agent that initiated the trace. */
  initiator_agent_id: string;
  /** All spans in this trace, ordered by start time. */
  spans: TraceSpan[];
  /** Total number of spans. */
  span_count: number;
  /** Total trace duration (root span start → last span end) in ms. */
  duration_ms: number;
  /** Whether any span has error status. */
  has_errors: boolean;
  /** Number of unique agents involved. */
  agent_count: number;
  /** When the trace started (ISO-8601). */
  started_at: string;
  /** When the trace ended (ISO-8601, null if active). */
  ended_at: string | null;
}

// ──────────────────────────────────────────────
// Metrics
// ──────────────────────────────────────────────

/** Time bucket for metric aggregation. */
export type MetricGranularity = '1m' | '5m' | '15m' | '1h' | '6h' | '1d';

/** A single metric data point. */
export interface MetricDataPoint {
  /** Metric name (e.g., "task.latency_ms", "agent.error_rate"). */
  metric: string;
  /** Metric value. */
  value: number;
  /** Timestamp of this data point (ISO-8601). */
  timestamp: string;
  /** Dimension tags for filtering/grouping. */
  tags: Record<string, string>;
}

/** Aggregated metric over a time window. */
export interface MetricAggregate {
  metric: string;
  tags: Record<string, string>;
  /** Number of data points in the window. */
  count: number;
  /** Statistical aggregates. */
  min: number;
  max: number;
  sum: number;
  avg: number;
  /** Percentiles. */
  p50: number;
  p95: number;
  p99: number;
  /** Time range (ISO-8601). */
  window_start: string;
  window_end: string;
}

/** Pre-defined metric names for the A2A system. */
export const A2A_METRICS = {
  // Task metrics
  TASK_LATENCY: 'a2a.task.latency_ms',
  TASK_SUBMITTED: 'a2a.task.submitted',
  TASK_COMPLETED: 'a2a.task.completed',
  TASK_FAILED: 'a2a.task.failed',
  TASK_TIMEOUT: 'a2a.task.timeout',

  // Routing metrics
  ROUTE_LATENCY: 'a2a.route.latency_ms',
  ROUTE_CANDIDATES: 'a2a.route.candidates_evaluated',
  ROUTE_NO_MATCH: 'a2a.route.no_match',

  // Agent metrics
  AGENT_ACTIVE: 'a2a.agent.active',
  AGENT_RESPONSE_TIME: 'a2a.agent.response_time_ms',
  AGENT_ERROR_RATE: 'a2a.agent.error_rate',
  AGENT_LOAD: 'a2a.agent.load',

  // Workflow metrics
  WORKFLOW_DURATION: 'a2a.workflow.duration_ms',
  WORKFLOW_STEP_DURATION: 'a2a.workflow.step_duration_ms',
  WORKFLOW_FAILURE_RATE: 'a2a.workflow.failure_rate',

  // Economic metrics
  SETTLEMENT_AMOUNT: 'a2a.billing.settlement_amount',
  AUCTION_BID_COUNT: 'a2a.auction.bid_count',
  CONTRACT_BREACH_RATE: 'a2a.contract.breach_rate',
} as const;

// ──────────────────────────────────────────────
// Anomaly Detection
// ──────────────────────────────────────────────

/** Severity of a detected anomaly. */
export type AnomalySeverity = 'info' | 'warning' | 'critical';

/** Type of anomaly detected. */
export type AnomalyType =
  | 'latency_spike'       // Sudden increase in operation latency
  | 'error_burst'         // Abnormal error rate
  | 'throughput_drop'     // Unexpected decrease in task throughput
  | 'agent_degradation'   // Single agent showing degraded performance
  | 'cascade_failure'     // Failures propagating across agents
  | 'sla_risk'            // SLA breach predicted based on current trends
  | 'cost_anomaly';       // Unexpected billing spike

/** A detected anomaly in the A2A system. */
export interface Anomaly {
  /** Unique anomaly ID. */
  id: string;
  /** What kind of anomaly. */
  type: AnomalyType;
  /** How severe. */
  severity: AnomalySeverity;
  /** Human-readable description. */
  description: string;
  /** Which agent(s) are affected. */
  affected_agent_ids: string[];
  /** Related trace IDs for investigation. */
  related_trace_ids: TraceId[];
  /** Metric that triggered the anomaly. */
  metric: string;
  /** Current (anomalous) value. */
  observed_value: number;
  /** Expected baseline value. */
  expected_value: number;
  /** Standard deviations from expected (z-score). */
  deviation: number;
  /** Whether this anomaly is still active. */
  is_active: boolean;
  /** When detected (ISO-8601). */
  detected_at: string;
  /** When resolved (ISO-8601, null if active). */
  resolved_at: string | null;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/traces — start a new trace. */
export interface TraceStartRequest {
  /** Root operation name. */
  operation: string;
  /** Span kind for the root span. */
  kind?: SpanKind;
  /** Structured attributes. */
  attributes?: Record<string, string | number | boolean>;
  /** Optional: link to a parent trace context for continuation. */
  parent_context?: TraceContext;
}

/** Response from trace start. */
export interface TraceStartResponse {
  trace_id: TraceId;
  root_span_id: SpanId;
  context: TraceContext;
  started_at: string;
}

/** POST /api/a2a/traces/:traceId/spans — create a child span. */
export interface SpanCreateRequest {
  /** Parent span ID. */
  parent_span_id: SpanId;
  /** Operation name. */
  operation: string;
  /** Span kind. */
  kind?: SpanKind;
  /** Structured attributes. */
  attributes?: Record<string, string | number | boolean>;
  /** Links to related spans. */
  links?: SpanLink[];
}

/** Response from span creation. */
export interface SpanCreateResponse {
  span_id: SpanId;
  trace_id: TraceId;
  context: TraceContext;
  started_at: string;
}

/** PATCH /api/a2a/traces/:traceId/spans/:spanId — end or update a span. */
export interface SpanUpdateRequest {
  /** Set status. */
  status?: SpanStatus;
  /** Error details if status is 'error'. */
  error_message?: string;
  error_code?: string;
  /** Add attributes. */
  attributes?: Record<string, string | number | boolean>;
  /** Add events. */
  events?: Omit<SpanEvent, 'timestamp'>[];
  /** End the span (sets ended_at to now). */
  end?: boolean;
}

/** Response from span update. */
export interface SpanUpdateResponse {
  span_id: SpanId;
  status: SpanStatus;
  duration_ms: number | null;
  ended_at: string | null;
}

/** GET /api/a2a/traces/:traceId — full trace view. */
export interface TraceDetailResponse {
  trace: Trace;
}

/** GET /api/a2a/traces — list/search traces. */
export interface TraceListResponse {
  traces: Trace[];
  count: number;
}

/** GET /api/a2a/metrics — aggregated metrics. */
export interface MetricsResponse {
  metrics: MetricAggregate[];
  granularity: MetricGranularity;
  window_start: string;
  window_end: string;
}

/** GET /api/a2a/anomalies — detected anomalies. */
export interface AnomalyListResponse {
  anomalies: Anomaly[];
  count: number;
}

/** Agent performance summary (derived from traces + metrics). */
export interface AgentPerformanceSummary {
  agent_id: string;
  agent_name: string;
  /** Time period for this summary. */
  window_start: string;
  window_end: string;
  /** Task performance. */
  tasks_completed: number;
  tasks_failed: number;
  success_rate: number;
  /** Latency stats (ms). */
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  /** Error rate (0-1). */
  error_rate: number;
  /** Throughput (tasks/hour). */
  throughput_per_hour: number;
  /** Active anomaly count. */
  active_anomalies: number;
  /** Current health assessment. */
  health: 'healthy' | 'degraded' | 'unhealthy';
}

/** GET /api/a2a/observability/health — system-wide health dashboard. */
export interface SystemHealthResponse {
  /** Overall system health. */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Active trace count. */
  active_traces: number;
  /** Active anomaly count. */
  active_anomalies: number;
  /** Per-agent performance summaries. */
  agents: AgentPerformanceSummary[];
  /** System-wide metrics for the current window. */
  system_metrics: {
    total_tasks_last_hour: number;
    avg_latency_ms: number;
    error_rate: number;
    active_agents: number;
  };
  /** Timestamp of this snapshot. */
  generated_at: string;
}
