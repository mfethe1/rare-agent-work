/**
 * A2A Agent Service Mesh Engine
 *
 * The resilience layer that sits between task routing and agent execution.
 * Every request flows through the mesh, which enforces circuit breakers,
 * applies load balancing, manages bulkhead partitions, and handles retries
 * — all transparently to the requesting agent.
 *
 * Architecture:
 *   Request → Mesh Policy Resolution → Health Assembly → Circuit Check
 *     → Bulkhead Check → Load Balance Selection → Execute (with retry/hedge)
 *
 * Integrates with:
 *   - Discovery: heartbeat data for load/availability
 *   - Reputation: dynamic scores for adaptive balancing
 *   - Router: capability matching for candidate selection
 *   - Observability: mesh events emitted for tracing
 *   - Webhooks: circuit state change notifications
 */

import { getServiceDb } from '../auth';
import type {
  CircuitBreaker,
  CircuitState,
  MeshPolicy,
  AgentHealthSnapshot,
  MeshRoutingResult,
  LoadBalanceStrategy,
  AdaptiveWeights,
  RetryPolicy,
  HedgingPolicy,
  BulkheadPartition,
  MeshEvent,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_ADAPTIVE_WEIGHTS,
  DEFAULT_RETRY_POLICY,
  DEFAULT_HEDGING_POLICY,
  DEFAULT_BULKHEAD_CONFIG,
} from './types';

// Re-import as values (const imports aren't available from type-only imports)
const CB_DEFAULTS = {
  failure_threshold: 5,
  recovery_threshold: 3,
  open_duration_ms: 30_000,
  evaluation_window_ms: 60_000,
  failure_rate_threshold: 0.5,
};

const ADAPTIVE_DEFAULTS = {
  latency: 0.40,
  error_rate: 0.35,
  load: 0.25,
};

const RETRY_DEFAULTS: RetryPolicy = {
  max_retries: 3,
  initial_delay_ms: 500,
  backoff_multiplier: 2.0,
  max_delay_ms: 10_000,
  jitter_factor: 0.25,
  retryable_errors: ['timeout', 'overloaded', 'circuit_open', 'agent_unavailable'],
  non_retryable_errors: ['invalid_input', 'unauthorized', 'rejected'],
};

const HEDGING_DEFAULTS: HedgingPolicy = {
  enabled: false,
  max_parallel: 2,
  hedge_delay_ms: 500,
  latency_threshold_ms: 2000,
};

// ──────────────────────────────────────────────
// Circuit Breaker State Machine
// ──────────────────────────────────────────────

/**
 * Get or create a circuit breaker for an agent.
 * Creates with default config if none exists.
 */
export async function getCircuitBreaker(agent_id: string): Promise<
  CircuitBreaker | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const { data, error } = await db
    .from('a2a_circuit_breakers')
    .select('*')
    .eq('agent_id', agent_id)
    .single();

  if (error && error.code === 'PGRST116') {
    // No breaker exists — create one in closed state
    const { data: created, error: createErr } = await db
      .from('a2a_circuit_breakers')
      .insert({
        agent_id,
        state: 'closed' as CircuitState,
        failure_count: 0,
        success_count: 0,
        ...CB_DEFAULTS,
        window_request_count: 0,
      })
      .select()
      .single();

    if (createErr) return { error: `Failed to create circuit breaker: ${createErr.message}`, status_code: 500 };
    return created as CircuitBreaker;
  }

  if (error) return { error: `Failed to fetch circuit breaker: ${error.message}`, status_code: 500 };

  // Check if open circuit should transition to half_open
  const breaker = data as CircuitBreaker;
  if (breaker.state === 'open' && breaker.last_tripped_at) {
    const elapsed = Date.now() - new Date(breaker.last_tripped_at).getTime();
    if (elapsed >= breaker.open_duration_ms) {
      return await transitionCircuit(breaker.id, 'half_open');
    }
  }

  return breaker;
}

/**
 * Record a successful request through the circuit breaker.
 * In half_open state, increments success_count toward recovery_threshold.
 */
export async function recordSuccess(agent_id: string): Promise<
  CircuitBreaker | { error: string; status_code: number }
> {
  const breaker = await getCircuitBreaker(agent_id);
  if ('error' in breaker) return breaker;

  const db = getServiceDb()!;

  if (breaker.state === 'half_open') {
    const newSuccessCount = breaker.success_count + 1;
    if (newSuccessCount >= breaker.recovery_threshold) {
      // Recovered — close the circuit
      return await transitionCircuit(breaker.id, 'closed');
    }
    const { data, error } = await db
      .from('a2a_circuit_breakers')
      .update({
        success_count: newSuccessCount,
        window_request_count: breaker.window_request_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', breaker.id)
      .select()
      .single();

    if (error) return { error: error.message, status_code: 500 };
    return data as CircuitBreaker;
  }

  // In closed state, just increment window count (success resets failure count)
  if (breaker.state === 'closed') {
    const { data, error } = await db
      .from('a2a_circuit_breakers')
      .update({
        failure_count: 0,
        window_request_count: breaker.window_request_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', breaker.id)
      .select()
      .single();

    if (error) return { error: error.message, status_code: 500 };
    return data as CircuitBreaker;
  }

  return breaker;
}

/**
 * Record a failed request through the circuit breaker.
 * May trip the circuit from closed → open.
 */
export async function recordFailure(agent_id: string): Promise<
  CircuitBreaker | { error: string; status_code: number }
> {
  const breaker = await getCircuitBreaker(agent_id);
  if ('error' in breaker) return breaker;

  const db = getServiceDb()!;
  const now = new Date().toISOString();

  if (breaker.state === 'half_open') {
    // Any failure in half_open → back to open
    return await transitionCircuit(breaker.id, 'open');
  }

  if (breaker.state === 'closed') {
    const newFailureCount = breaker.failure_count + 1;
    const newWindowCount = breaker.window_request_count + 1;
    const failureRate = newWindowCount > 0 ? newFailureCount / newWindowCount : 0;

    // Trip if either threshold is exceeded
    const shouldTrip =
      newFailureCount >= breaker.failure_threshold ||
      (newWindowCount >= 5 && failureRate >= breaker.failure_rate_threshold);

    if (shouldTrip) {
      return await transitionCircuit(breaker.id, 'open');
    }

    const { data, error } = await db
      .from('a2a_circuit_breakers')
      .update({
        failure_count: newFailureCount,
        window_request_count: newWindowCount,
        last_failure_at: now,
        updated_at: now,
      })
      .eq('id', breaker.id)
      .select()
      .single();

    if (error) return { error: error.message, status_code: 500 };
    return data as CircuitBreaker;
  }

  return breaker;
}

/**
 * Transition a circuit breaker to a new state.
 * Resets counters appropriately for the target state.
 */
async function transitionCircuit(
  breaker_id: string,
  target_state: CircuitState,
): Promise<CircuitBreaker | { error: string; status_code: number }> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    state: target_state,
    updated_at: now,
  };

  switch (target_state) {
    case 'open':
      updates.last_tripped_at = now;
      updates.success_count = 0;
      break;
    case 'half_open':
      updates.success_count = 0;
      updates.failure_count = 0;
      break;
    case 'closed':
      updates.failure_count = 0;
      updates.success_count = 0;
      updates.window_request_count = 0;
      updates.last_tripped_at = null;
      break;
  }

  const { data, error } = await db
    .from('a2a_circuit_breakers')
    .update(updates)
    .eq('id', breaker_id)
    .select()
    .single();

  if (error) return { error: error.message, status_code: 500 };
  return data as CircuitBreaker;
}

// ──────────────────────────────────────────────
// Health Snapshot Assembly
// ──────────────────────────────────────────────

/**
 * Assemble health snapshots for a set of candidate agents.
 * Combines heartbeat data, circuit breaker state, and reputation into
 * a unified view used by the load balancer.
 */
export async function assembleHealthSnapshots(
  agent_ids: string[],
): Promise<AgentHealthSnapshot[] | { error: string; status_code: number }> {
  if (agent_ids.length === 0) return [];

  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  // Fetch all data in parallel
  const [agentsResult, heartbeatsResult, breakersResult, reputationResult] = await Promise.all([
    db.from('agent_registry').select('id, name').in('id', agent_ids),
    db.from('agent_heartbeats')
      .select('agent_id, load_factor, active_tasks, max_concurrent_tasks')
      .in('agent_id', agent_ids)
      .order('recorded_at', { ascending: false }),
    db.from('a2a_circuit_breakers')
      .select('*')
      .in('agent_id', agent_ids),
    db.from('a2a_agent_reputation')
      .select('agent_id, avg_rating, failure_rate, avg_latency_ms, p95_latency_ms')
      .in('agent_id', agent_ids),
  ]);

  if (agentsResult.error) return { error: agentsResult.error.message, status_code: 500 };

  // Index data by agent_id for O(1) lookup
  const agents = new Map((agentsResult.data ?? []).map((a: { id: string; name: string }) => [a.id, a]));

  // Use most recent heartbeat per agent
  const heartbeats = new Map<string, { load_factor: number; active_tasks: number; max_concurrent_tasks: number }>();
  for (const hb of heartbeatsResult.data ?? []) {
    if (!heartbeats.has(hb.agent_id)) {
      heartbeats.set(hb.agent_id, hb);
    }
  }

  const breakers = new Map(
    (breakersResult.data ?? []).map((b: CircuitBreaker) => [b.agent_id, b]),
  );

  const reputations = new Map(
    (reputationResult.data ?? []).map((r: { agent_id: string; avg_rating: number; failure_rate: number; avg_latency_ms: number; p95_latency_ms: number }) => [r.agent_id, r]),
  );

  const now = new Date().toISOString();

  return agent_ids.map((id) => {
    const agent = agents.get(id);
    const hb = heartbeats.get(id);
    const cb = breakers.get(id);
    const rep = reputations.get(id);

    const load_factor = hb?.load_factor ?? 0.5;
    const active_tasks = hb?.active_tasks ?? 0;
    const max_concurrent = hb?.max_concurrent_tasks ?? 10;
    const error_rate = rep?.failure_rate ?? 0;
    const avg_latency = rep?.avg_latency_ms ?? 1000;
    const p95_latency = rep?.p95_latency_ms ?? 3000;
    const reputation = rep?.avg_rating ? rep.avg_rating / 5.0 : 0.5;

    // Compute composite health score (0-1, higher = healthier)
    const latency_score = Math.max(0, 1 - avg_latency / 10000);
    const error_score = 1 - error_rate;
    const load_score = 1 - load_factor;
    const health_score =
      latency_score * ADAPTIVE_DEFAULTS.latency +
      error_score * ADAPTIVE_DEFAULTS.error_rate +
      load_score * ADAPTIVE_DEFAULTS.load;

    return {
      agent_id: id,
      agent_name: agent?.name ?? 'unknown',
      circuit_state: (cb?.state ?? 'closed') as CircuitState,
      active_tasks,
      max_concurrent_tasks: max_concurrent,
      load_factor,
      avg_latency_ms: avg_latency,
      p95_latency_ms: p95_latency,
      error_rate,
      reputation_score: reputation,
      health_score: Math.round(health_score * 1000) / 1000,
      computed_at: now,
    } satisfies AgentHealthSnapshot;
  });
}

// ──────────────────────────────────────────────
// Load Balancing Strategies
// ──────────────────────────────────────────────

/**
 * Select an agent from healthy candidates using the specified strategy.
 * Only considers agents with closed or half_open circuits.
 */
export function selectAgent(
  candidates: AgentHealthSnapshot[],
  strategy: LoadBalanceStrategy,
  weights: AdaptiveWeights = ADAPTIVE_DEFAULTS,
): AgentHealthSnapshot | null {
  // Filter out agents with open circuits
  const healthy = candidates.filter((c) => c.circuit_state !== 'open');
  if (healthy.length === 0) return null;

  switch (strategy) {
    case 'weighted_round_robin':
      return selectWeightedRoundRobin(healthy);
    case 'least_connections':
      return selectLeastConnections(healthy);
    case 'latency_weighted':
      return selectLatencyWeighted(healthy);
    case 'adaptive':
      return selectAdaptive(healthy, weights);
    default:
      return healthy[0] ?? null;
  }
}

/**
 * Weighted random selection using health_score as probability weight.
 */
function selectWeightedRoundRobin(candidates: AgentHealthSnapshot[]): AgentHealthSnapshot | null {
  const totalWeight = candidates.reduce((sum, c) => sum + c.health_score, 0);
  if (totalWeight === 0) return candidates[0] ?? null;

  let random = Math.random() * totalWeight;
  for (const candidate of candidates) {
    random -= candidate.health_score;
    if (random <= 0) return candidate;
  }
  return candidates[candidates.length - 1] ?? null;
}

/**
 * Select agent with fewest active tasks, breaking ties by health_score.
 */
function selectLeastConnections(candidates: AgentHealthSnapshot[]): AgentHealthSnapshot | null {
  return candidates.reduce((best, c) => {
    if (c.active_tasks < best.active_tasks) return c;
    if (c.active_tasks === best.active_tasks && c.health_score > best.health_score) return c;
    return best;
  });
}

/**
 * Select agent with lowest average latency, weighted by inverse latency.
 */
function selectLatencyWeighted(candidates: AgentHealthSnapshot[]): AgentHealthSnapshot | null {
  // Inverse latency weighting — lower latency = higher weight
  const maxLatency = Math.max(...candidates.map((c) => c.avg_latency_ms), 1);
  const weights = candidates.map((c) => maxLatency / Math.max(c.avg_latency_ms, 1));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let random = Math.random() * totalWeight;
  for (let i = 0; i < candidates.length; i++) {
    random -= weights[i];
    if (random <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1] ?? null;
}

/**
 * Adaptive multi-factor scoring. Combines latency, error rate, and load
 * into a single score using configurable weights.
 */
function selectAdaptive(
  candidates: AgentHealthSnapshot[],
  weights: AdaptiveWeights,
): AgentHealthSnapshot | null {
  const maxLatency = Math.max(...candidates.map((c) => c.avg_latency_ms), 1);

  const scored = candidates.map((c) => {
    const latencyScore = 1 - c.avg_latency_ms / (maxLatency * 1.5);
    const errorScore = 1 - c.error_rate;
    const loadScore = 1 - c.load_factor;

    return {
      candidate: c,
      score:
        Math.max(0, latencyScore) * weights.latency +
        errorScore * weights.error_rate +
        loadScore * weights.load,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // Weighted random among top 3 to avoid thundering herd
  const top = scored.slice(0, Math.min(3, scored.length));
  const totalScore = top.reduce((s, t) => s + t.score, 0);
  if (totalScore === 0) return top[0]?.candidate ?? null;

  let random = Math.random() * totalScore;
  for (const entry of top) {
    random -= entry.score;
    if (random <= 0) return entry.candidate;
  }
  return top[top.length - 1]?.candidate ?? null;
}

// ──────────────────────────────────────────────
// Bulkhead Isolation
// ──────────────────────────────────────────────

/**
 * Check if a consumer can acquire a bulkhead slot with a provider.
 * Returns true if the request can proceed, false if the bulkhead is full.
 */
export async function acquireBulkheadSlot(
  provider_agent_id: string,
  consumer_agent_id: string,
): Promise<{ allowed: boolean; partition?: BulkheadPartition } | { error: string; status_code: number }> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  // Try specific partition first, then default '*'
  const { data: partitions } = await db
    .from('a2a_bulkhead_partitions')
    .select('*')
    .eq('provider_agent_id', provider_agent_id)
    .in('consumer_agent_id', [consumer_agent_id, '*'])
    .order('consumer_agent_id', { ascending: false }); // specific first

  const partition = (partitions ?? [])[0] as BulkheadPartition | undefined;
  if (!partition) {
    // No bulkhead configured — allow freely
    return { allowed: true };
  }

  if (partition.active_count >= partition.max_concurrent) {
    // Check queue
    if (partition.queue_depth >= partition.max_queue_size) {
      return { allowed: false, partition };
    }
    // Would be queued — for now, reject (queue is a future enhancement)
    return { allowed: false, partition };
  }

  // Increment active count
  const { data: updated, error } = await db
    .from('a2a_bulkhead_partitions')
    .update({
      active_count: partition.active_count + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', partition.id)
    .select()
    .single();

  if (error) return { error: error.message, status_code: 500 };
  return { allowed: true, partition: updated as BulkheadPartition };
}

/**
 * Release a bulkhead slot after task completion.
 */
export async function releaseBulkheadSlot(
  provider_agent_id: string,
  consumer_agent_id: string,
): Promise<void> {
  const db = getServiceDb();
  if (!db) return;

  const { data: partitions } = await db
    .from('a2a_bulkhead_partitions')
    .select('id, active_count')
    .eq('provider_agent_id', provider_agent_id)
    .in('consumer_agent_id', [consumer_agent_id, '*'])
    .order('consumer_agent_id', { ascending: false });

  const partition = (partitions ?? [])[0];
  if (!partition) return;

  await db
    .from('a2a_bulkhead_partitions')
    .update({
      active_count: Math.max(0, partition.active_count - 1),
      updated_at: new Date().toISOString(),
    })
    .eq('id', partition.id);
}

// ──────────────────────────────────────────────
// Retry Logic
// ──────────────────────────────────────────────

/**
 * Compute the delay before the next retry attempt.
 * Uses exponential backoff with configurable jitter.
 */
export function computeRetryDelay(policy: RetryPolicy, attempt: number): number {
  const baseDelay = policy.initial_delay_ms * Math.pow(policy.backoff_multiplier, attempt);
  const cappedDelay = Math.min(baseDelay, policy.max_delay_ms);
  const jitter = cappedDelay * policy.jitter_factor * Math.random();
  return Math.round(cappedDelay + jitter);
}

/**
 * Determine if an error is retryable under the given policy.
 */
export function isRetryable(policy: RetryPolicy, error_type: string): boolean {
  // Non-retryable errors always take precedence
  if (policy.non_retryable_errors.includes(error_type)) return false;
  // If retryable list is empty, all errors (not in non-retryable) are retryable
  if (policy.retryable_errors.length === 0) return true;
  return policy.retryable_errors.includes(error_type);
}

// ──────────────────────────────────────────────
// Mesh Policy Resolution
// ──────────────────────────────────────────────

/**
 * Find the most specific mesh policy matching a capability string.
 * Falls back to the '*' wildcard policy, then to built-in defaults.
 */
export async function resolvePolicy(capability: string): Promise<
  MeshPolicy | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const { data: policies, error } = await db
    .from('a2a_mesh_policies')
    .select('*')
    .eq('is_active', true)
    .order('capability_pattern', { ascending: false }); // longer patterns first

  if (error) return { error: error.message, status_code: 500 };

  // Find best matching policy
  for (const policy of policies ?? []) {
    const pattern = policy.capability_pattern;
    if (pattern === '*') continue; // wildcard is fallback
    if (pattern === capability) return policy as MeshPolicy;
    // Domain prefix match: "news.*" matches "news.query"
    if (pattern.endsWith('.*')) {
      const domain = pattern.slice(0, -2);
      if (capability.startsWith(domain)) return policy as MeshPolicy;
    }
  }

  // Try wildcard
  const wildcard = (policies ?? []).find(
    (p: { capability_pattern: string }) => p.capability_pattern === '*',
  );
  if (wildcard) return wildcard as MeshPolicy;

  // Built-in default (no DB record needed)
  return {
    id: '__default__',
    name: 'Built-in Default',
    capability_pattern: '*',
    lb_strategy: 'adaptive',
    adaptive_weights: ADAPTIVE_DEFAULTS,
    circuit_breaker_config: CB_DEFAULTS,
    retry_policy: RETRY_DEFAULTS,
    hedging_policy: HEDGING_DEFAULTS,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────
// Mesh Routing (top-level entry point)
// ──────────────────────────────────────────────

/**
 * Route a task through the service mesh.
 *
 * This is the primary entry point. Given a capability and candidate agent IDs
 * (from the router's capability matching), the mesh:
 *   1. Resolves the applicable mesh policy
 *   2. Assembles health snapshots for all candidates
 *   3. Filters out agents with open circuits
 *   4. Applies the load balancing strategy to select the best agent
 *   5. Returns full routing metadata for observability
 */
export async function routeThroughMesh(params: {
  capability: string;
  candidate_agent_ids: string[];
}): Promise<MeshRoutingResult | { error: string; status_code: number }> {
  const { capability, candidate_agent_ids } = params;

  if (candidate_agent_ids.length === 0) {
    return {
      routed: false,
      selected_agent_id: null,
      selected_agent_name: null,
      selected_health: null,
      lb_strategy: 'adaptive',
      candidates: [],
      excluded_agents: [],
      retry_policy: RETRY_DEFAULTS,
      hedging_policy: HEDGING_DEFAULTS,
      policy_id: null,
      selection_reason: 'No candidate agents provided',
    };
  }

  // 1. Resolve policy
  const policy = await resolvePolicy(capability);
  if ('error' in policy) return policy;

  // 2. Assemble health snapshots
  const snapshots = await assembleHealthSnapshots(candidate_agent_ids);
  if ('error' in snapshots) return snapshots;

  // 3. Identify excluded agents (open circuits)
  const excluded = snapshots
    .filter((s) => s.circuit_state === 'open')
    .map((s) => ({
      agent_id: s.agent_id,
      reason: 'Circuit breaker open',
      retry_after_ms: policy.circuit_breaker_config.open_duration_ms,
    }));

  // 4. Select agent using load balancing
  const selected = selectAgent(
    snapshots,
    policy.lb_strategy,
    policy.adaptive_weights,
  );

  if (!selected) {
    return {
      routed: false,
      selected_agent_id: null,
      selected_agent_name: null,
      selected_health: null,
      lb_strategy: policy.lb_strategy,
      candidates: snapshots,
      excluded_agents: excluded,
      retry_policy: policy.retry_policy,
      hedging_policy: policy.hedging_policy,
      policy_id: policy.id,
      selection_reason: excluded.length > 0
        ? `All ${excluded.length} candidates have open circuit breakers`
        : 'No healthy candidates available',
    };
  }

  // 5. Build selection reason
  const healthyCount = snapshots.filter((s) => s.circuit_state !== 'open').length;
  const reason = [
    `Selected via ${policy.lb_strategy}`,
    `(${healthyCount} healthy / ${snapshots.length} total candidates)`,
    `health=${selected.health_score}`,
    `load=${selected.load_factor}`,
    `latency=${selected.avg_latency_ms}ms`,
    `errors=${(selected.error_rate * 100).toFixed(1)}%`,
  ].join(' ');

  return {
    routed: true,
    selected_agent_id: selected.agent_id,
    selected_agent_name: selected.agent_name,
    selected_health: selected,
    lb_strategy: policy.lb_strategy,
    candidates: snapshots,
    excluded_agents: excluded,
    retry_policy: policy.retry_policy,
    hedging_policy: policy.hedging_policy,
    policy_id: policy.id,
    selection_reason: reason,
  };
}

// ──────────────────────────────────────────────
// Mesh Policy CRUD
// ──────────────────────────────────────────────

export async function createMeshPolicy(input: {
  name: string;
  capability_pattern: string;
  lb_strategy: LoadBalanceStrategy;
  adaptive_weights?: AdaptiveWeights;
  circuit_breaker_config?: Partial<typeof CB_DEFAULTS>;
  retry_policy?: Partial<RetryPolicy>;
  hedging_policy?: Partial<HedgingPolicy>;
}): Promise<MeshPolicy | { error: string; status_code: number }> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const row = {
    name: input.name,
    capability_pattern: input.capability_pattern,
    lb_strategy: input.lb_strategy,
    adaptive_weights: { ...ADAPTIVE_DEFAULTS, ...input.adaptive_weights },
    circuit_breaker_config: { ...CB_DEFAULTS, ...input.circuit_breaker_config },
    retry_policy: { ...RETRY_DEFAULTS, ...input.retry_policy },
    hedging_policy: { ...HEDGING_DEFAULTS, ...input.hedging_policy },
    is_active: true,
  };

  const { data, error } = await db
    .from('a2a_mesh_policies')
    .insert(row)
    .select()
    .single();

  if (error) return { error: error.message, status_code: 500 };
  return data as MeshPolicy;
}

export async function listMeshPolicies(): Promise<
  MeshPolicy[] | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const { data, error } = await db
    .from('a2a_mesh_policies')
    .select('*')
    .order('capability_pattern');

  if (error) return { error: error.message, status_code: 500 };
  return (data ?? []) as MeshPolicy[];
}

export async function updateMeshPolicy(
  policy_id: string,
  updates: Partial<{
    name: string;
    lb_strategy: LoadBalanceStrategy;
    adaptive_weights: AdaptiveWeights;
    circuit_breaker_config: typeof CB_DEFAULTS;
    retry_policy: RetryPolicy;
    hedging_policy: HedgingPolicy;
    is_active: boolean;
  }>,
): Promise<MeshPolicy | { error: string; status_code: number }> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const { data, error } = await db
    .from('a2a_mesh_policies')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', policy_id)
    .select()
    .single();

  if (error) return { error: error.message, status_code: 500 };
  return data as MeshPolicy;
}

// ──────────────────────────────────────────────
// Bulkhead CRUD
// ──────────────────────────────────────────────

export async function createBulkheadPartition(input: {
  provider_agent_id: string;
  consumer_agent_id: string;
  max_concurrent?: number;
  max_queue_size?: number;
}): Promise<BulkheadPartition | { error: string; status_code: number }> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const { data, error } = await db
    .from('a2a_bulkhead_partitions')
    .insert({
      provider_agent_id: input.provider_agent_id,
      consumer_agent_id: input.consumer_agent_id,
      max_concurrent: input.max_concurrent ?? 10,
      max_queue_size: input.max_queue_size ?? 50,
      active_count: 0,
      queue_depth: 0,
    })
    .select()
    .single();

  if (error) return { error: error.message, status_code: 500 };
  return data as BulkheadPartition;
}

// ──────────────────────────────────────────────
// Health Dashboard
// ──────────────────────────────────────────────

/**
 * Get a mesh-wide health dashboard showing all agents, their circuit
 * breaker states, health scores, and active mesh policies.
 */
export async function getMeshHealth(): Promise<{
  agents: AgentHealthSnapshot[];
  policies: MeshPolicy[];
  summary: {
    total_agents: number;
    healthy_agents: number;
    degraded_agents: number;
    circuit_open_agents: number;
    avg_health_score: number;
  };
} | { error: string; status_code: number }> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  // Get all active agents
  const { data: agents, error: agentErr } = await db
    .from('agent_registry')
    .select('id')
    .eq('is_active', true);

  if (agentErr) return { error: agentErr.message, status_code: 500 };
  const agentIds = (agents ?? []).map((a: { id: string }) => a.id);

  if (agentIds.length === 0) {
    const policies = await listMeshPolicies();
    if ('error' in policies) return policies;
    return {
      agents: [],
      policies,
      summary: {
        total_agents: 0,
        healthy_agents: 0,
        degraded_agents: 0,
        circuit_open_agents: 0,
        avg_health_score: 0,
      },
    };
  }

  const [snapshots, policies] = await Promise.all([
    assembleHealthSnapshots(agentIds),
    listMeshPolicies(),
  ]);

  if ('error' in snapshots) return snapshots;
  if ('error' in policies) return policies;

  const circuitOpen = snapshots.filter((s) => s.circuit_state === 'open').length;
  const degraded = snapshots.filter(
    (s) => s.circuit_state === 'half_open' || s.health_score < 0.5,
  ).length;
  const healthy = snapshots.length - circuitOpen - degraded;
  const avgHealth =
    snapshots.length > 0
      ? snapshots.reduce((sum, s) => sum + s.health_score, 0) / snapshots.length
      : 0;

  return {
    agents: snapshots,
    policies,
    summary: {
      total_agents: snapshots.length,
      healthy_agents: healthy,
      degraded_agents: degraded,
      circuit_open_agents: circuitOpen,
      avg_health_score: Math.round(avgHealth * 1000) / 1000,
    },
  };
}
