// ── A2A Distributed Tracing & Observability ──

export {
  generateTraceId,
  generateSpanId,
  encodeTraceparent,
  decodeTraceparent,
  startTrace,
  createSpan,
  endSpan,
  annotateSpan,
  getTrace,
  listTraces,
  recordMetric,
  queryMetrics,
  aggregateIntoBuckets,
  percentile,
  detectAnomalies,
  listAnomalies,
  standardDeviation,
  getAgentPerformance,
  getSystemHealth,
} from './engine';

export {
  traceContextSchema,
  traceStartSchema,
  spanCreateSchema,
  spanUpdateSchema,
  traceListSchema,
  metricsQuerySchema,
  metricRecordSchema,
  anomalyListSchema,
  agentPerformanceSchema,
} from './validation';

export type {
  TraceContextInput,
  TraceStartInput,
  SpanCreateInput,
  SpanUpdateInput,
  TraceListInput,
  MetricsQueryInput,
  MetricRecordInput,
  AnomalyListInput,
  AgentPerformanceInput,
} from './validation';

export type {
  TraceId,
  SpanId,
  SpanStatus,
  SpanKind,
  TraceSpan,
  SpanEvent,
  SpanLink,
  TraceContext,
  Trace,
  MetricGranularity,
  MetricDataPoint,
  MetricAggregate,
  AnomalySeverity,
  AnomalyType,
  Anomaly,
  TraceStartRequest,
  TraceStartResponse,
  SpanCreateRequest,
  SpanCreateResponse,
  SpanUpdateRequest,
  SpanUpdateResponse,
  TraceDetailResponse,
  TraceListResponse,
  MetricsResponse,
  AnomalyListResponse,
  AgentPerformanceSummary,
  SystemHealthResponse,
} from './types';

export { A2A_METRICS } from './types';
