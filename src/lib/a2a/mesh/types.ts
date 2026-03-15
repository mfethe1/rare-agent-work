/**
 * A2A Agent Service Mesh — Type Definitions
 *
 * Production-grade resilience primitives for the agent-to-agent ecosystem.
 * In 2028, agents are mission-critical operators — when one fails, the mesh
 * must absorb the failure, reroute traffic, and protect the broader system.
 *
 * Core primitives:
 *   1. Circuit Breakers — stop routing to failing agents before cascading
 *   2. Load Balancing — distribute work using health-aware strategies
 *   3. Bulkhead Isolation — prevent one agent from consuming all capacity
 *   4. Retry Policies — structured retry with backoff and jitter
 *   5. Request Hedging — speculative parallel execution for latency-sensitive work
 *   6. Health Probes — active + passive health checking per agent
 */

// ──────────────────────────────────────────────
// Circuit Breaker
// ──────────────────────────────────────────────

/**
 * Martin Fowler circuit breaker states:
 *   closed   → normal operation, failures counted
 *   open     → requests short-circuited, agent is excluded from routing
 *   half_open → limited probe traffic to test recovery
 */
export type CircuitState = 'closed' | 'open' | 'half_open';

/**
 * Persistent circuit breaker record per agent.
 * Stored in DB so state survives serverless cold starts.
 */
export interface CircuitBreaker {
  id: string;
  agent_id: string;
  state: CircuitState;
  /** Consecutive failure count in current closed window. */
  failure_count: number;
  /** Consecutive success count in half_open probing. */
  success_count: number;
  /** Failures needed to trip from closed → open. */
  failure_threshold: number;
  /** Successes needed to recover from half_open → closed. */
  recovery_threshold: number;
  /** How long the circuit stays open before transitioning to half_open (ms). */
  open_duration_ms: number;
  /** When the circuit was last tripped open. */
  last_tripped_at: string | null;
  /** When the last failure was recorded. */
  last_failure_at: string | null;
  /** Sliding window for failure rate calculation (ms). */
  evaluation_window_ms: number;
  /** Total requests in current evaluation window. */
  window_request_count: number;
  /** Failure rate threshold (0-1) that trips the breaker. */
  failure_rate_threshold: number;
  created_at: string;
  updated_at: string;
}

/** Defaults for new circuit breakers. */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG = {
  failure_threshold: 5,
  recovery_threshold: 3,
  open_duration_ms: 30_000,       // 30s cooldown
  evaluation_window_ms: 60_000,   // 1min sliding window
  failure_rate_threshold: 0.5,    // 50% failure rate trips
} as const;

// ──────────────────────────────────────────────
// Load Balancing
// ──────────────────────────────────────────────

/**
 * Load balancing strategies for distributing tasks across healthy agents.
 *
 *   weighted_round_robin — classic WRR using health scores as weights
 *   least_connections    — route to agent with fewest active tasks
 *   latency_weighted     — bias toward agents with lower P50 latency
 *   adaptive             — dynamic blend: latency (40%) + error rate (35%) + load (25%)
 */
export type LoadBalanceStrategy =
  | 'weighted_round_robin'
  | 'least_connections'
  | 'latency_weighted'
  | 'adaptive';

/**
 * Health snapshot used for load balancing decisions.
 * Assembled from heartbeats, circuit breakers, and reputation metrics.
 */
export interface AgentHealthSnapshot {
  agent_id: string;
  agent_name: string;
  /** Circuit breaker state — open agents are excluded entirely. */
  circuit_state: CircuitState;
  /** Current active tasks (from heartbeat). */
  active_tasks: number;
  /** Max concurrent tasks the agent can handle. */
  max_concurrent_tasks: number;
  /** Load factor 0-1 (active_tasks / max_concurrent). */
  load_factor: number;
  /** Average response latency in ms (from recent task completions). */
  avg_latency_ms: number;
  /** P95 response latency in ms. */
  p95_latency_ms: number;
  /** Error rate in the last evaluation window (0-1). */
  error_rate: number;
  /** Reputation score (0-1) from the reputation system. */
  reputation_score: number;
  /** Composite health score (0-1), higher is healthier. */
  health_score: number;
  /** When this snapshot was computed. */
  computed_at: string;
}

/**
 * Adaptive score weights — configurable per mesh policy.
 */
export interface AdaptiveWeights {
  latency: number;    // default 0.40
  error_rate: number; // default 0.35
  load: number;       // default 0.25
}

export const DEFAULT_ADAPTIVE_WEIGHTS: AdaptiveWeights = {
  latency: 0.40,
  error_rate: 0.35,
  load: 0.25,
};

// ──────────────────────────────────────────────
// Bulkhead Isolation
// ──────────────────────────────────────────────

/**
 * Bulkhead partitions limit how much capacity any single consumer
 * can use from a provider agent, preventing noisy-neighbor problems.
 */
export interface BulkheadPartition {
  id: string;
  /** The provider agent whose capacity is being partitioned. */
  provider_agent_id: string;
  /** The consumer agent (or '*' for default partition). */
  consumer_agent_id: string;
  /** Max concurrent tasks this consumer can have active with this provider. */
  max_concurrent: number;
  /** Max tasks queued waiting for a slot. */
  max_queue_size: number;
  /** Current active count. */
  active_count: number;
  /** Current queue depth. */
  queue_depth: number;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_BULKHEAD_CONFIG = {
  max_concurrent: 10,
  max_queue_size: 50,
} as const;

// ──────────────────────────────────────────────
// Retry Policy
// ──────────────────────────────────────────────

/**
 * Structured retry policy with exponential backoff and jitter.
 * Attached to mesh routing decisions — the mesh retries transparently
 * before returning failure to the requesting agent.
 */
export interface RetryPolicy {
  /** Max retry attempts (0 = no retries). */
  max_retries: number;
  /** Initial backoff delay in ms. */
  initial_delay_ms: number;
  /** Backoff multiplier per retry. */
  backoff_multiplier: number;
  /** Maximum delay cap in ms. */
  max_delay_ms: number;
  /** Add random jitter (0-1) as fraction of computed delay. */
  jitter_factor: number;
  /** Only retry on these failure types (empty = retry all). */
  retryable_errors: string[];
  /** Never retry on these (takes precedence over retryable). */
  non_retryable_errors: string[];
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  max_retries: 3,
  initial_delay_ms: 500,
  backoff_multiplier: 2.0,
  max_delay_ms: 10_000,
  jitter_factor: 0.25,
  retryable_errors: ['timeout', 'overloaded', 'circuit_open', 'agent_unavailable'],
  non_retryable_errors: ['invalid_input', 'unauthorized', 'rejected'],
};

// ──────────────────────────────────────────────
// Request Hedging
// ──────────────────────────────────────────────

/**
 * Hedging sends the same request to multiple agents simultaneously.
 * The first successful response wins; others are cancelled.
 * Use for latency-sensitive work where cost of redundant compute is acceptable.
 */
export interface HedgingPolicy {
  /** Enable hedging for this route. */
  enabled: boolean;
  /** Max parallel hedged requests. */
  max_parallel: number;
  /** Delay before launching each additional hedge (ms). */
  hedge_delay_ms: number;
  /** Only hedge if estimated latency exceeds this threshold (ms). */
  latency_threshold_ms: number;
}

export const DEFAULT_HEDGING_POLICY: HedgingPolicy = {
  enabled: false,
  max_parallel: 2,
  hedge_delay_ms: 500,
  latency_threshold_ms: 2000,
};

// ──────────────────────────────────────────────
// Mesh Policy (ties everything together)
// ──────────────────────────────────────────────

/**
 * A mesh policy is the top-level configuration for how the service mesh
 * handles routing for a specific capability domain or agent group.
 */
export interface MeshPolicy {
  id: string;
  /** Human-readable name for this policy. */
  name: string;
  /** Capability domain this policy applies to (e.g., 'news.*', '*'). */
  capability_pattern: string;
  /** Load balancing strategy. */
  lb_strategy: LoadBalanceStrategy;
  /** Adaptive weights (only used when lb_strategy = 'adaptive'). */
  adaptive_weights: AdaptiveWeights;
  /** Circuit breaker configuration overrides. */
  circuit_breaker_config: {
    failure_threshold: number;
    recovery_threshold: number;
    open_duration_ms: number;
    evaluation_window_ms: number;
    failure_rate_threshold: number;
  };
  /** Retry policy for this domain. */
  retry_policy: RetryPolicy;
  /** Hedging policy for this domain. */
  hedging_policy: HedgingPolicy;
  /** Whether this policy is active. */
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// Mesh Routing Result
// ──────────────────────────────────────────────

/**
 * Extended routing result that includes mesh resilience metadata.
 * Consumers see exactly why an agent was selected and what protections are active.
 */
export interface MeshRoutingResult {
  /** Whether a healthy agent was found. */
  routed: boolean;
  /** Selected agent ID (primary). */
  selected_agent_id: string | null;
  /** Agent name for observability. */
  selected_agent_name: string | null;
  /** Health snapshot of selected agent. */
  selected_health: AgentHealthSnapshot | null;
  /** Load balancing strategy used. */
  lb_strategy: LoadBalanceStrategy;
  /** All candidate health snapshots (for transparency). */
  candidates: AgentHealthSnapshot[];
  /** Agents excluded due to open circuit breakers. */
  excluded_agents: Array<{ agent_id: string; reason: string; retry_after_ms: number }>;
  /** Active retry policy. */
  retry_policy: RetryPolicy;
  /** Active hedging policy. */
  hedging_policy: HedgingPolicy;
  /** Mesh policy that was applied. */
  policy_id: string | null;
  /** Why this agent was selected. */
  selection_reason: string;
}

// ──────────────────────────────────────────────
// Mesh Events (for webhook integration)
// ──────────────────────────────────────────────

export type MeshEventType =
  | 'circuit.opened'
  | 'circuit.half_opened'
  | 'circuit.closed'
  | 'circuit.tripped'
  | 'agent.health_degraded'
  | 'agent.health_recovered'
  | 'bulkhead.exhausted'
  | 'retry.exhausted'
  | 'hedge.winner_selected';

export interface MeshEvent {
  type: MeshEventType;
  agent_id: string;
  policy_id: string | null;
  details: Record<string, unknown>;
  timestamp: string;
}
