/**
 * A2A Event Streaming & Webhook System — Types
 *
 * Real-time event backbone for the agent ecosystem. Agents subscribe to
 * event streams (filtered by topic, agent, or custom predicates) and
 * receive push notifications via webhooks or SSE. Replays allow agents
 * to catch up after disconnections.
 *
 * Design principles:
 *   1. Every state change in the A2A platform emits an event.
 *   2. Events are immutable, ordered, and durable.
 *   3. Delivery is at-least-once with idempotent consumers.
 *   4. Subscriptions support fine-grained filters to avoid firehose overload.
 *   5. Dead-letter queues prevent data loss when webhooks fail.
 */

// ---------------------------------------------------------------------------
// Event Domains — every A2A subsystem has a domain
// ---------------------------------------------------------------------------

export type EventDomain =
  | 'task'
  | 'agent'
  | 'contract'
  | 'auction'
  | 'billing'
  | 'delegation'
  | 'governance'
  | 'workflow'
  | 'channel'
  | 'knowledge'
  | 'federation'
  | 'mesh'
  | 'identity'
  | 'observability';

// ---------------------------------------------------------------------------
// Event Actions — fine-grained state transitions within each domain
// ---------------------------------------------------------------------------

export type TaskEventAction =
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'feedback_received'
  | 'routed'
  | 'timeout';

export type AgentEventAction =
  | 'registered'
  | 'deregistered'
  | 'profile_updated'
  | 'heartbeat'
  | 'status_changed'
  | 'capability_added'
  | 'capability_removed';

export type ContractEventAction =
  | 'proposed'
  | 'counter_proposed'
  | 'accepted'
  | 'activated'
  | 'completed'
  | 'terminated'
  | 'breached'
  | 'sla_warning'
  | 'sla_violation';

export type AuctionEventAction =
  | 'created'
  | 'bid_placed'
  | 'bid_withdrawn'
  | 'evaluating'
  | 'awarded'
  | 'settled'
  | 'cancelled'
  | 'expired'
  | 'price_updated'; // dutch auction price ticks

export type BillingEventAction =
  | 'deposit'
  | 'withdrawal'
  | 'charge'
  | 'earning'
  | 'hold_placed'
  | 'hold_released'
  | 'refund'
  | 'wallet_frozen'
  | 'wallet_unfrozen'
  | 'low_balance_warning';

export type DelegationEventAction =
  | 'created'
  | 'activated'
  | 'used'
  | 'revoked'
  | 'expired'
  | 'chain_extended';

export type GovernanceEventAction =
  | 'policy_created'
  | 'policy_updated'
  | 'policy_deleted'
  | 'action_allowed'
  | 'action_denied'
  | 'action_escalated'
  | 'escalation_resolved'
  | 'kill_switch_activated'
  | 'kill_switch_lifted';

export type WorkflowEventAction =
  | 'created'
  | 'triggered'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'step_skipped'
  | 'step_retrying'
  | 'completed'
  | 'failed'
  | 'timed_out'
  | 'cancelled';

export type ChannelEventAction =
  | 'created'
  | 'message_sent'
  | 'member_added'
  | 'member_removed'
  | 'proposal_created'
  | 'vote_cast'
  | 'archived';

export type KnowledgeEventAction =
  | 'node_created'
  | 'node_updated'
  | 'node_merged'
  | 'edge_created'
  | 'edge_removed'
  | 'contradiction_detected'
  | 'knowledge_decayed'
  | 'knowledge_reinforced';

export type FederationEventAction =
  | 'peer_requested'
  | 'peer_activated'
  | 'peer_suspended'
  | 'peer_revoked'
  | 'remote_agent_discovered'
  | 'federated_task_submitted'
  | 'federated_task_completed'
  | 'capability_sync_completed'
  | 'capability_sync_failed';

export type MeshEventAction =
  | 'circuit_opened'
  | 'circuit_closed'
  | 'circuit_half_opened'
  | 'health_degraded'
  | 'health_recovered'
  | 'bulkhead_exhausted'
  | 'retry_exhausted'
  | 'hedge_selected';

export type IdentityEventAction =
  | 'key_registered'
  | 'key_revoked'
  | 'challenge_issued'
  | 'challenge_verified'
  | 'envelope_signed'
  | 'delegation_token_issued';

export type ObservabilityEventAction =
  | 'anomaly_detected'
  | 'threshold_breached'
  | 'trace_completed'
  | 'alert_fired';

export type EventAction =
  | TaskEventAction
  | AgentEventAction
  | ContractEventAction
  | AuctionEventAction
  | BillingEventAction
  | DelegationEventAction
  | GovernanceEventAction
  | WorkflowEventAction
  | ChannelEventAction
  | KnowledgeEventAction
  | FederationEventAction
  | MeshEventAction
  | IdentityEventAction
  | ObservabilityEventAction;

// ---------------------------------------------------------------------------
// Event Topic — structured addressing: "domain.action"
// ---------------------------------------------------------------------------

/**
 * Topics follow the pattern `{domain}.{action}`.
 * Subscriptions can use wildcards: `task.*`, `*.completed`, `*.*`.
 */
export type EventTopic = `${EventDomain}.${string}`;

// ---------------------------------------------------------------------------
// A2AEvent — the core event envelope
// ---------------------------------------------------------------------------

export interface A2AEvent<T = unknown> {
  /** Platform-assigned unique event ID (UUIDv7 for time-ordering) */
  id: string;

  /** Monotonically increasing sequence number within the platform */
  sequence: number;

  /** ISO 8601 timestamp of when the event was produced */
  timestamp: string;

  /** Structured topic: "{domain}.{action}" */
  topic: EventTopic;

  /** The domain this event belongs to */
  domain: EventDomain;

  /** The specific action/transition */
  action: string;

  /** Agent that caused this event (null for system events) */
  source_agent_id: string | null;

  /** Primary resource affected (task ID, contract ID, etc.) */
  resource_id: string;

  /** Resource type for filtering */
  resource_type: string;

  /** Correlation ID linking related events across operations */
  correlation_id: string | null;

  /** Trace context for distributed tracing propagation */
  trace_context: EventTraceContext | null;

  /** The event payload — domain-specific data */
  data: T;

  /** Schema version for payload evolution */
  schema_version: string;

  /** Idempotency key — consumers use this to deduplicate */
  idempotency_key: string;
}

export interface EventTraceContext {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
}

// ---------------------------------------------------------------------------
// Subscriptions — how agents declare interest
// ---------------------------------------------------------------------------

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'suspended';

export type DeliveryMethod = 'webhook' | 'sse' | 'websocket';

export interface EventSubscription {
  id: string;
  agent_id: string;
  created_at: string;
  updated_at: string;
  status: SubscriptionStatus;

  /** Human-readable name for the subscription */
  name: string;

  /** Delivery configuration */
  delivery: DeliveryConfig;

  /** Which events to receive */
  filter: EventFilter;

  /** Processing guarantees */
  options: SubscriptionOptions;
}

export interface DeliveryConfig {
  method: DeliveryMethod;

  /** For webhook: the URL to POST events to */
  webhook_url?: string;

  /** For webhook: optional secret for HMAC-SHA256 signature verification */
  webhook_secret?: string;

  /** For webhook: custom headers to include */
  webhook_headers?: Record<string, string>;

  /** Timeout for webhook delivery in milliseconds */
  timeout_ms: number;

  /** Batch size — how many events per delivery (1 = real-time, >1 = micro-batch) */
  batch_size: number;

  /** Max wait before flushing a partial batch (ms) */
  batch_window_ms: number;
}

export interface EventFilter {
  /** Topic patterns with wildcard support: "task.*", "*.completed", "auction.bid_placed" */
  topics: string[];

  /** Only events from these agents (empty = all) */
  source_agent_ids?: string[];

  /** Only events affecting these resource IDs */
  resource_ids?: string[];

  /** Only events matching these resource types */
  resource_types?: string[];

  /** Only events in these domains */
  domains?: EventDomain[];

  /** JSONPath-like predicates on event.data for fine-grained filtering */
  data_filters?: DataFilter[];
}

export interface DataFilter {
  /** Dot-notation path into event.data (e.g., "priority", "amount.value") */
  path: string;

  /** Comparison operator */
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'exists' | 'in';

  /** Value to compare against (ignored for "exists") */
  value?: unknown;
}

export interface SubscriptionOptions {
  /** Start from this sequence number (for replay / catch-up) */
  start_from_sequence?: number;

  /** Start from this timestamp (alternative to sequence) */
  start_from_timestamp?: string;

  /** Maximum events per second (rate limiting) */
  max_events_per_second: number;

  /** Whether to include the full event payload or just metadata */
  include_data: boolean;

  /** Auto-pause after N consecutive delivery failures */
  max_consecutive_failures: number;

  /** Enable dead-letter queue for failed deliveries */
  dead_letter_enabled: boolean;
}

// ---------------------------------------------------------------------------
// Webhook Delivery Tracking
// ---------------------------------------------------------------------------

export type DeliveryStatus =
  | 'pending'
  | 'delivered'
  | 'failed'
  | 'retrying'
  | 'dead_lettered'
  | 'expired';

export interface DeliveryAttempt {
  id: string;
  subscription_id: string;
  event_id: string;
  event_sequence: number;
  status: DeliveryStatus;
  created_at: string;
  delivered_at: string | null;

  /** Number of attempts so far */
  attempt_count: number;

  /** Next retry scheduled at (null if delivered or dead-lettered) */
  next_retry_at: string | null;

  /** HTTP status code of last attempt (for webhooks) */
  last_status_code: number | null;

  /** Error message from last failed attempt */
  last_error: string | null;

  /** Response time of last attempt in ms */
  last_latency_ms: number | null;
}

// ---------------------------------------------------------------------------
// Retry Policy — exponential backoff with jitter
// ---------------------------------------------------------------------------

export interface RetryPolicy {
  /** Maximum number of delivery attempts */
  max_attempts: number;

  /** Initial delay between retries in ms */
  initial_delay_ms: number;

  /** Backoff multiplier (e.g., 2 = double each time) */
  backoff_multiplier: number;

  /** Maximum delay cap in ms */
  max_delay_ms: number;

  /** Add random jitter (0-1) to prevent thundering herd */
  jitter_factor: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  max_attempts: 5,
  initial_delay_ms: 1000,
  backoff_multiplier: 2,
  max_delay_ms: 60_000,
  jitter_factor: 0.25,
};

// ---------------------------------------------------------------------------
// Dead-Letter Queue
// ---------------------------------------------------------------------------

export interface DeadLetterEntry {
  id: string;
  subscription_id: string;
  event_id: string;
  event: A2AEvent;
  failed_at: string;
  failure_reason: string;
  attempt_count: number;

  /** Whether this entry has been manually replayed */
  replayed: boolean;
  replayed_at: string | null;
}

// ---------------------------------------------------------------------------
// SSE Stream State
// ---------------------------------------------------------------------------

export interface SSEConnection {
  id: string;
  subscription_id: string;
  agent_id: string;
  connected_at: string;
  last_event_sequence: number;
  last_heartbeat_at: string;
  status: 'connected' | 'disconnected';
}

// ---------------------------------------------------------------------------
// Event Replay — catch-up after disconnection
// ---------------------------------------------------------------------------

export interface ReplayRequest {
  subscription_id: string;

  /** Replay events starting from this sequence number */
  from_sequence: number;

  /** Up to this sequence (inclusive). Omit for "up to now" */
  to_sequence?: number;

  /** Maximum number of events to replay */
  limit: number;
}

export interface ReplayResponse {
  events: A2AEvent[];
  first_sequence: number;
  last_sequence: number;
  has_more: boolean;
  total_available: number;
}

// ---------------------------------------------------------------------------
// Event Stream Metrics
// ---------------------------------------------------------------------------

export interface StreamMetrics {
  /** Total events emitted across the platform */
  total_events_emitted: number;

  /** Events emitted in the last hour */
  events_last_hour: number;

  /** Active subscriptions */
  active_subscriptions: number;

  /** Active SSE connections */
  active_sse_connections: number;

  /** Delivery success rate (0-1) over the last hour */
  delivery_success_rate: number;

  /** Average delivery latency in ms */
  avg_delivery_latency_ms: number;

  /** P99 delivery latency in ms */
  p99_delivery_latency_ms: number;

  /** Dead-letter queue depth */
  dead_letter_depth: number;

  /** Events per second (current throughput) */
  events_per_second: number;

  /** Per-domain event counts for the last hour */
  domain_counts: Record<EventDomain, number>;
}

// ---------------------------------------------------------------------------
// Subscription Health — monitoring
// ---------------------------------------------------------------------------

export interface SubscriptionHealth {
  subscription_id: string;
  status: SubscriptionStatus;
  consecutive_failures: number;
  last_delivery_at: string | null;
  last_failure_at: string | null;
  events_delivered_last_hour: number;
  events_failed_last_hour: number;
  avg_latency_ms: number;
  dead_letter_depth: number;
  lag: number; // events behind the latest sequence
}

// ---------------------------------------------------------------------------
// Webhook Signature — HMAC verification for secure delivery
// ---------------------------------------------------------------------------

export interface WebhookSignature {
  /** Signature algorithm */
  algorithm: 'hmac-sha256';

  /** The computed signature in hex */
  signature: string;

  /** Timestamp used in the signature (prevents replay attacks) */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Event Catalog — self-documenting event types
// ---------------------------------------------------------------------------

export interface EventCatalogEntry {
  topic: EventTopic;
  domain: EventDomain;
  action: string;
  description: string;
  schema_version: string;

  /** JSON Schema for the event data payload */
  data_schema: Record<string, unknown>;

  /** Example payload */
  example: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Valid status transitions for subscriptions
// ---------------------------------------------------------------------------

export const VALID_SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  active: ['paused', 'cancelled', 'suspended'],
  paused: ['active', 'cancelled'],
  cancelled: [],
  suspended: ['active', 'cancelled'],
};
