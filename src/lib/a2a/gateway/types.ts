/**
 * A2A Gateway Types
 *
 * The Gateway is the unified entry point for agent consumption of the platform.
 * It provides three capabilities that make the 178-endpoint surface agent-native:
 *
 * 1. Batch Operations — execute multiple API calls in a single request with
 *    dependency resolution (step outputs feed into subsequent step inputs).
 * 2. SSE Streaming — real-time Server-Sent Events for task progress, platform
 *    events, and long-running operation status.
 * 3. Protocol Introspection — machine-readable API catalog with executable
 *    schemas that agents can programmatically navigate and compose.
 */

// ──────────────────────────────────────────────
// Batch Operations
// ──────────────────────────────────────────────

/** HTTP methods supported in batch steps. */
export type BatchMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * A single step in a batch request.
 * Steps can reference outputs of previous steps using `{{stepId.path}}` templates.
 */
export interface BatchStep {
  /** Unique step identifier within this batch. */
  id: string;

  /** HTTP method for this step. */
  method: BatchMethod;

  /**
   * API path relative to /api/a2a (e.g., "/tasks", "/agents").
   * Supports template interpolation: "/tasks/{{register.data.task_id}}"
   */
  path: string;

  /** Request body (for POST/PATCH/PUT). Supports template interpolation in string values. */
  body?: Record<string, unknown>;

  /** Query parameters. Supports template interpolation. */
  params?: Record<string, string>;

  /**
   * Step IDs that must complete successfully before this step runs.
   * If omitted, step runs as early as possible based on template references.
   */
  depends_on?: string[];

  /**
   * If true, batch continues even if this step fails.
   * Default: false (batch aborts on first failure).
   */
  optional?: boolean;

  /** Per-step timeout in milliseconds. Default: 10000. */
  timeout_ms?: number;
}

/** Request body for POST /api/a2a/gateway/batch */
export interface BatchRequest {
  /** Ordered list of steps to execute. */
  steps: BatchStep[];

  /**
   * Execution strategy.
   * - "sequential": Steps execute one at a time in order.
   * - "parallel": Independent steps execute concurrently; dependent steps wait.
   * Default: "parallel"
   */
  strategy?: 'sequential' | 'parallel';

  /** Overall batch timeout in milliseconds. Default: 30000. */
  timeout_ms?: number;

  /** Correlation ID for tracing. Auto-generated if omitted. */
  correlation_id?: string;
}

/** Result of a single batch step. */
export interface BatchStepResult {
  /** Step ID. */
  id: string;

  /** HTTP status code from the internal route. */
  status: number;

  /** Response body from the internal route. */
  data: unknown;

  /** Duration of this step in milliseconds. */
  duration_ms: number;

  /** Error message if the step failed. */
  error?: string;
}

/** Aggregate batch execution status. */
export type BatchStatus = 'completed' | 'partial' | 'failed';

/** Response body for POST /api/a2a/gateway/batch */
export interface BatchResponse {
  /** Overall batch status. */
  status: BatchStatus;

  /** Correlation ID for tracing. */
  correlation_id: string;

  /** Results keyed by step ID, in execution order. */
  results: BatchStepResult[];

  /** Total execution time in milliseconds. */
  total_duration_ms: number;

  /** Count of successful steps. */
  succeeded: number;

  /** Count of failed steps. */
  failed: number;
}

// ──────────────────────────────────────────────
// SSE Streaming
// ──────────────────────────────────────────────

/** Event types emitted on the SSE stream. */
export type StreamEventType =
  | 'connected'
  | 'task.progress'
  | 'task.completed'
  | 'task.failed'
  | 'agent.heartbeat'
  | 'workflow.step_completed'
  | 'workflow.completed'
  | 'platform.event'
  | 'ping'
  | 'error';

/** A single SSE event payload. */
export interface StreamEvent {
  /** Event type for SSE `event:` field. */
  type: StreamEventType;

  /** Event data payload. */
  data: Record<string, unknown>;

  /** ISO timestamp. */
  timestamp: string;

  /** Correlation ID if applicable. */
  correlation_id?: string;
}

/** Query params for GET /api/a2a/gateway/stream */
export interface StreamSubscription {
  /** Event types to subscribe to. Default: all types. */
  events?: StreamEventType[];

  /** Filter events to a specific task ID. */
  task_id?: string;

  /** Filter events to a specific workflow execution ID. */
  workflow_id?: string;

  /** Filter events to a specific agent ID. */
  agent_id?: string;

  /** Replay events after this ISO timestamp. */
  since?: string;
}

// ──────────────────────────────────────────────
// Protocol Introspection
// ──────────────────────────────────────────────

/** Describes a single API endpoint for agent consumption. */
export interface EndpointDescriptor {
  /** Unique endpoint identifier (e.g., "tasks.submit", "billing.wallet"). */
  id: string;

  /** Human/agent-readable description. */
  description: string;

  /** HTTP method. */
  method: BatchMethod;

  /** API path (relative to /api/a2a). */
  path: string;

  /** The A2A domain this endpoint belongs to. */
  domain: string;

  /** Whether authentication is required. */
  requires_auth: boolean;

  /** Minimum trust level required (if any). */
  min_trust_level?: string;

  /** JSON Schema for the request body (if applicable). */
  request_schema?: Record<string, unknown>;

  /** JSON Schema for the response body. */
  response_schema?: Record<string, unknown>;

  /** Example request body. */
  example_request?: Record<string, unknown>;

  /** Rate limit tier that applies. */
  rate_limit_tier?: string;

  /** Tags for categorization. */
  tags: string[];
}

/** Describes an A2A domain (group of related endpoints). */
export interface DomainDescriptor {
  /** Domain identifier (e.g., "tasks", "billing", "governance"). */
  id: string;

  /** Human/agent-readable description. */
  description: string;

  /** Number of endpoints in this domain. */
  endpoint_count: number;

  /** Endpoint IDs in this domain. */
  endpoints: string[];

  /** When this domain was added (loop number). */
  added_in_loop?: number;
}

/** Response body for GET /api/a2a/gateway/introspect */
export interface IntrospectionResponse {
  /** Protocol version. */
  protocol: string;

  /** Protocol version number. */
  version: string;

  /** Platform description. */
  description: string;

  /** Total number of endpoints. */
  total_endpoints: number;

  /** All domains with their metadata. */
  domains: DomainDescriptor[];

  /** All endpoints (filterable via query params). */
  endpoints: EndpointDescriptor[];

  /** Gateway-specific capabilities. */
  gateway: {
    batch: { max_steps: number; max_timeout_ms: number; strategies: string[] };
    streaming: { event_types: StreamEventType[]; max_connections_per_agent: number };
    introspection: { filterable_by: string[] };
  };

  /** ISO timestamp of when this introspection was generated. */
  generated_at: string;
}

/** Query params for GET /api/a2a/gateway/introspect */
export interface IntrospectionQuery {
  /** Filter endpoints by domain. */
  domain?: string;

  /** Filter endpoints by tag. */
  tag?: string;

  /** Filter endpoints by method. */
  method?: BatchMethod;

  /** Filter endpoints requiring auth or not. */
  requires_auth?: boolean;

  /** Free-text search across endpoint descriptions. */
  search?: string;

  /** If true, include full schemas. Default: false (summary only). */
  include_schemas?: boolean;
}
