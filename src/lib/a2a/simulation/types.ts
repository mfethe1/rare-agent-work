/**
 * Agent Digital Twin & Multi-Agent Simulation Protocol — Types
 *
 * Loop 19 of the Visionary Council self-improvement series.
 *
 * Critical gap identified by the council:
 *
 * Geoffrey Hinton: "The sandbox evaluates agents in isolation. But emergent
 * failures arise from interactions — cascading faults, resource contention,
 * feedback loops. You're testing organs, not the organism."
 *
 * Demis Hassabis: "No production replay capability. When incidents occur,
 * you can't clone the topology, inject the same conditions, and reproduce
 * the failure deterministically. This is pre-scientific debugging."
 *
 * Elon Musk: "Where's the chaos engineering? Netflix had Chaos Monkey in
 * 2011. It's 2028 and your agent platform can't inject network partitions,
 * latency spikes, or byzantine failures into a simulated topology."
 *
 * This module introduces:
 *   1. Digital Twins — behavioral clones of production agents for simulation
 *   2. Simulation Environments — complete multi-agent topology snapshots
 *   3. Chaos Events — injectable fault conditions (partitions, latency, failures)
 *   4. Scenario Playbooks — scripted multi-step interaction sequences
 *   5. Simulation Execution — time-accelerated runs with full trace capture
 *   6. Comparative Analysis — A/B comparison between simulation runs
 *   7. Production Replay — clone topology + inject recorded conditions
 *
 * Lifecycle:
 *   Snapshot topology → create digital twins → define playbook →
 *   inject chaos → execute simulation → capture traces →
 *   compare with baseline → generate report
 */

// ──────────────────────────────────────────────
// Digital Twins
// ──────────────────────────────────────────────

/**
 * A digital twin is a behavioral model of a production agent,
 * capturing its capabilities, typical response patterns, latency
 * characteristics, and failure modes. Twins can be configured to
 * faithfully replicate production behavior or to simulate degraded
 * conditions for testing.
 */
export interface DigitalTwin {
  /** Platform-assigned twin ID (UUID). */
  id: string;
  /** The production agent this twin models. */
  source_agent_id: string;
  /** Human-readable label for this twin. */
  label: string;
  /** Behavioral model parameters. */
  behavior: TwinBehavior;
  /** Current twin status. */
  status: TwinStatus;
  /** Which simulation this twin belongs to. */
  simulation_id: string;
  created_at: string;
  updated_at: string;
}

export type TwinStatus = 'provisioning' | 'ready' | 'active' | 'failed' | 'retired';

/** Behavioral characteristics that define how a twin responds. */
export interface TwinBehavior {
  /** Capabilities cloned from the source agent. */
  capabilities: string[];
  /** Mean response latency in ms. */
  latency_mean_ms: number;
  /** Latency standard deviation. */
  latency_stddev_ms: number;
  /** Probability of task failure (0-1). */
  failure_rate: number;
  /** Typical failure modes with weights (mode → probability). */
  failure_modes: Record<string, number>;
  /** Cost per task in credits. */
  cost_per_task: number;
  /** Maximum concurrent tasks this twin can handle. */
  max_concurrency: number;
  /** Custom response templates by intent (intent → response). */
  response_templates: Record<string, Record<string, unknown>>;
}

// ──────────────────────────────────────────────
// Simulation Environments
// ──────────────────────────────────────────────

export type SimulationStatus =
  | 'draft'        // Created, not yet started
  | 'provisioning' // Twins being created
  | 'ready'        // All twins provisioned, waiting for execution
  | 'running'      // Simulation in progress
  | 'completed'    // Finished — results available
  | 'failed'       // Simulation errored
  | 'cancelled';   // User cancelled

/**
 * A simulation environment is a complete snapshot of a multi-agent
 * topology, including digital twins, communication channels,
 * chaos conditions, and execution parameters.
 */
export interface SimulationEnvironment {
  /** Platform-assigned simulation ID (UUID). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Description of what this simulation tests. */
  description: string;
  /** Who created this simulation. */
  created_by: string;
  /** Current status. */
  status: SimulationStatus;
  /** Digital twins in this simulation. */
  twin_ids: string[];
  /** Chaos events to inject during execution. */
  chaos_events: ChaosEvent[];
  /** Scenario playbook defining agent interactions. */
  playbook: ScenarioPlaybook;
  /** Simulation execution parameters. */
  config: SimulationConfig;
  /** Results after execution. */
  result?: SimulationResult;
  /** Tags for categorization. */
  tags: string[];
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

/** Simulation execution parameters. */
export interface SimulationConfig {
  /** Time acceleration factor (e.g., 10 = run 10x faster). */
  time_acceleration: number;
  /** Maximum wall-clock duration in seconds. */
  max_duration_seconds: number;
  /** Maximum total tasks across all twins. */
  max_total_tasks: number;
  /** Maximum total cost in credits. */
  max_total_cost: number;
  /** Random seed for deterministic replay. */
  seed?: number;
  /** Whether to capture full execution traces (verbose). */
  capture_traces: boolean;
  /** Whether to stop on first critical failure. */
  stop_on_critical_failure: boolean;
}

// ──────────────────────────────────────────────
// Chaos Engineering
// ──────────────────────────────────────────────

/**
 * Chaos event types that can be injected into a simulation:
 *
 * - agent_failure:      A twin stops responding entirely
 * - latency_spike:      A twin's response time increases dramatically
 * - network_partition:  Communication between specific twins is severed
 * - resource_exhaustion: A twin's cost/action budget is depleted
 * - byzantine_fault:    A twin returns incorrect/malicious responses
 * - cascade_trigger:    One failure triggers dependent failures
 * - load_surge:         Sudden increase in task volume
 * - data_corruption:    Garbled messages between twins
 */
export type ChaosEventType =
  | 'agent_failure'
  | 'latency_spike'
  | 'network_partition'
  | 'resource_exhaustion'
  | 'byzantine_fault'
  | 'cascade_trigger'
  | 'load_surge'
  | 'data_corruption';

/** A chaos event to inject at a specific point in the simulation. */
export interface ChaosEvent {
  /** Event ID (unique within simulation). */
  id: string;
  /** Type of chaos to inject. */
  type: ChaosEventType;
  /** Human-readable description. */
  description: string;
  /** When to inject (simulation-relative seconds). */
  trigger_at_seconds: number;
  /** Duration of the chaos condition in seconds (0 = permanent). */
  duration_seconds: number;
  /** Which twin(s) are affected. */
  target_twin_ids: string[];
  /** Type-specific parameters. */
  parameters: ChaosParameters;
}

/** Parameters for each chaos event type. */
export interface ChaosParameters {
  /** For latency_spike: additional latency in ms. */
  latency_increase_ms?: number;
  /** For network_partition: twin IDs that cannot communicate with targets. */
  partition_from_twin_ids?: string[];
  /** For byzantine_fault: probability of incorrect response (0-1). */
  byzantine_probability?: number;
  /** For load_surge: multiplier on task volume. */
  load_multiplier?: number;
  /** For data_corruption: probability of message corruption (0-1). */
  corruption_probability?: number;
  /** For cascade_trigger: twin IDs that fail when target fails. */
  cascade_twin_ids?: string[];
  /** For resource_exhaustion: percentage of budget consumed (0-1). */
  budget_consumed?: number;
}

// ──────────────────────────────────────────────
// Scenario Playbooks
// ──────────────────────────────────────────────

/**
 * A playbook defines a scripted sequence of interactions between
 * digital twins, including task submissions, message exchanges,
 * and expected outcomes.
 */
export interface ScenarioPlaybook {
  /** Human-readable name. */
  name: string;
  /** Steps executed in order (with optional parallelism). */
  steps: PlaybookStep[];
}

export type PlaybookStepType =
  | 'submit_task'       // One twin submits a task to another
  | 'broadcast_task'    // One twin submits a task routed to multiple twins
  | 'send_message'      // Direct message between twins
  | 'wait'              // Pause for specified duration
  | 'assert'            // Check a condition
  | 'parallel_group';   // Execute multiple steps concurrently

/** A single step in a playbook. */
export interface PlaybookStep {
  /** Step ID (unique within playbook). */
  id: string;
  /** Step type. */
  type: PlaybookStepType;
  /** Human-readable description. */
  description: string;
  /** Execution order (steps with same order run in parallel). */
  order: number;
  /** Step-specific configuration. */
  config: PlaybookStepConfig;
}

/** Configuration for each playbook step type. */
export interface PlaybookStepConfig {
  /** For submit_task: sender twin ID. */
  sender_twin_id?: string;
  /** For submit_task: target twin ID. */
  target_twin_id?: string;
  /** For submit_task/broadcast_task: task intent. */
  intent?: string;
  /** For submit_task/broadcast_task: task input payload. */
  input?: Record<string, unknown>;
  /** For broadcast_task: target twin IDs. */
  target_twin_ids?: string[];
  /** For send_message: message content. */
  message?: string;
  /** For wait: duration in simulation-seconds. */
  wait_seconds?: number;
  /** For assert: condition to check. */
  assertion?: PlaybookAssertion;
  /** For parallel_group: nested steps. */
  parallel_steps?: PlaybookStep[];
}

/** An assertion that can be checked mid-playbook. */
export interface PlaybookAssertion {
  /** What to check. */
  target: 'twin_status' | 'task_count' | 'message_count' | 'total_cost' | 'failure_count';
  /** Twin ID to check (if target is twin-specific). */
  twin_id?: string;
  /** Comparison operator. */
  op: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte';
  /** Expected value. */
  value: number | string;
}

// ──────────────────────────────────────────────
// Simulation Results
// ──────────────────────────────────────────────

/** Complete results from a simulation run. */
export interface SimulationResult {
  /** Total simulation wall-clock time in ms. */
  wall_clock_ms: number;
  /** Simulated time elapsed in seconds. */
  simulated_seconds: number;
  /** Per-twin metrics. */
  twin_metrics: TwinMetrics[];
  /** Interaction graph — who communicated with whom. */
  interaction_graph: InteractionEdge[];
  /** Chaos event outcomes. */
  chaos_outcomes: ChaosOutcome[];
  /** Assertion results from playbook. */
  assertion_results: AssertionResult[];
  /** Detected cascading failures. */
  cascade_chains: CascadeChain[];
  /** Overall health score (0-100). */
  ecosystem_health_score: number;
  /** Summary assessment. */
  summary: string;
}

/** Metrics collected for a single twin during simulation. */
export interface TwinMetrics {
  twin_id: string;
  source_agent_id: string;
  label: string;
  tasks_received: number;
  tasks_completed: number;
  tasks_failed: number;
  avg_latency_ms: number;
  p99_latency_ms: number;
  total_cost_credits: number;
  messages_sent: number;
  messages_received: number;
  uptime_fraction: number;
  /** Whether this twin was affected by chaos events. */
  chaos_affected: boolean;
  /** How the twin behaved during/after chaos. */
  recovery_time_ms?: number;
}

/** An edge in the interaction graph. */
export interface InteractionEdge {
  from_twin_id: string;
  to_twin_id: string;
  interaction_type: 'task' | 'message';
  count: number;
  avg_latency_ms: number;
  failure_rate: number;
}

/** Outcome of a specific chaos event injection. */
export interface ChaosOutcome {
  chaos_event_id: string;
  type: ChaosEventType;
  /** What actually happened. */
  impact_description: string;
  /** How many twins were directly affected. */
  direct_impact_count: number;
  /** How many twins were indirectly affected (cascading). */
  indirect_impact_count: number;
  /** Time to recovery after chaos ended (ms). */
  recovery_time_ms: number;
  /** Whether the ecosystem recovered fully. */
  full_recovery: boolean;
}

/** Result of a playbook assertion. */
export interface AssertionResult {
  step_id: string;
  description: string;
  passed: boolean;
  expected: string;
  actual: string;
}

/** A detected chain of cascading failures. */
export interface CascadeChain {
  /** The initiating failure. */
  root_twin_id: string;
  root_cause: string;
  /** Chain of affected twins in order. */
  chain: Array<{
    twin_id: string;
    failure_type: string;
    delay_ms: number;
  }>;
  /** Total number of twins affected. */
  total_affected: number;
  /** Time from root failure to last cascade. */
  total_cascade_time_ms: number;
}

// ──────────────────────────────────────────────
// Comparative Analysis
// ──────────────────────────────────────────────

/** A comparison between two simulation runs. */
export interface SimulationComparison {
  /** Platform-assigned comparison ID (UUID). */
  id: string;
  /** Baseline simulation. */
  baseline_simulation_id: string;
  /** Candidate simulation (the one being evaluated). */
  candidate_simulation_id: string;
  /** Per-metric deltas. */
  deltas: ComparisonDelta[];
  /** Overall verdict. */
  verdict: ComparisonVerdict;
  created_at: string;
}

/** Delta between baseline and candidate for a specific metric. */
export interface ComparisonDelta {
  metric: string;
  baseline_value: number;
  candidate_value: number;
  /** Percentage change (positive = increase). */
  change_percent: number;
  /** Whether this change is within acceptable bounds. */
  acceptable: boolean;
  /** Threshold for acceptability. */
  threshold_percent: number;
}

export type ComparisonVerdict =
  | 'improved'       // Candidate is better overall
  | 'equivalent'     // No significant difference
  | 'degraded'       // Candidate is worse
  | 'mixed';         // Some metrics better, some worse

// ──────────────────────────────────────────────
// API Request / Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/simulations — create a simulation environment. */
export interface SimulationCreateRequest {
  name: string;
  description: string;
  /** Production agent IDs to clone as digital twins. */
  source_agent_ids: string[];
  /** Optional: custom twin behavior overrides (agent_id → partial behavior). */
  twin_overrides?: Record<string, Partial<TwinBehavior>>;
  chaos_events?: Omit<ChaosEvent, 'id'>[];
  playbook: Omit<ScenarioPlaybook, 'steps'> & {
    steps: Omit<PlaybookStep, 'id'>[];
  };
  config?: Partial<SimulationConfig>;
  tags?: string[];
}

export interface SimulationCreateResponse {
  simulation_id: string;
  twin_ids: string[];
  status: SimulationStatus;
  created_at: string;
}

/** POST /api/a2a/simulations/:id/run — execute a simulation. */
export interface SimulationRunResponse {
  simulation_id: string;
  status: SimulationStatus;
  result: SimulationResult;
  completed_at: string;
}

/** GET /api/a2a/simulations/:id — get simulation details. */
export interface SimulationDetailResponse {
  simulation: SimulationEnvironment;
  twins: DigitalTwin[];
}

/** GET /api/a2a/simulations — list simulations. */
export interface SimulationListResponse {
  simulations: SimulationEnvironment[];
  count: number;
}

/** POST /api/a2a/simulations/compare — compare two simulation runs. */
export interface SimulationCompareRequest {
  baseline_simulation_id: string;
  candidate_simulation_id: string;
  /** Acceptable change thresholds per metric (metric → max % change). */
  thresholds?: Record<string, number>;
}

export interface SimulationCompareResponse {
  comparison: SimulationComparison;
}

/** POST /api/a2a/simulations/replay — replay a production incident. */
export interface SimulationReplayRequest {
  /** Name for the replay simulation. */
  name: string;
  /** Production agent IDs involved in the incident. */
  source_agent_ids: string[];
  /** Time window to replay (ISO timestamps). */
  replay_window: {
    start: string;
    end: string;
  };
  /** Optional: chaos events to inject (to test "what if" scenarios). */
  additional_chaos?: Omit<ChaosEvent, 'id'>[];
  /** Optional: twin behavior modifications for counterfactual analysis. */
  twin_overrides?: Record<string, Partial<TwinBehavior>>;
  tags?: string[];
}

export interface SimulationReplayResponse {
  simulation_id: string;
  twin_ids: string[];
  /** Number of production events captured for replay. */
  events_captured: number;
  status: SimulationStatus;
  created_at: string;
}
