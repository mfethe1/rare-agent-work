/**
 * A2A Goal Decomposition & Multi-Agent Planning Engine — Type Definitions
 *
 * The missing orchestration intelligence for the 2028 agentic era.
 *
 * Current state: the platform has world-class routing, contracts, governance,
 * and resilience — but every consumer agent must manually author workflow DAGs.
 * That's a 2024 pattern. In 2028, agents express high-level goals and the
 * platform decomposes them into optimal, dependency-aware execution plans
 * across the best available agents — automatically.
 *
 * Architecture:
 *   Goal → Decomposer → Sub-goals (tree) → Capability Mapper → Agent Selection
 *     → Plan Optimizer (cost/latency/quality pareto) → Executable Plan
 *     → Live Executor with re-planning on failure
 *
 * This layer sits ABOVE workflows: it *generates* workflow DAGs from intent.
 */

// ──────────────────────────────────────────────
// Goals — the user/agent-facing abstraction
// ──────────────────────────────────────────────

/**
 * A high-level goal submitted by an agent.
 * Goals are expressed in terms of *what* should happen, not *how*.
 */
export interface Goal {
  /** Unique goal ID (UUIDv7). */
  id: string;
  /** Agent submitting the goal. */
  requester_agent_id: string;
  /** Natural-language description of the desired outcome. */
  objective: string;
  /** Structured constraints on the goal. */
  constraints: GoalConstraints;
  /** Optional context/data to seed the plan. */
  context: Record<string, unknown>;
  /** Priority level — affects optimization trade-offs. */
  priority: GoalPriority;
  /** Current status. */
  status: GoalStatus;
  /** The plan generated for this goal (null until planned). */
  plan_id: string | null;
  created_at: string;
  updated_at: string;
}

export type GoalPriority = 'critical' | 'high' | 'normal' | 'low';

export type GoalStatus =
  | 'submitted'       // Goal received, not yet decomposed
  | 'decomposing'     // Decomposition in progress
  | 'planning'        // Sub-goals mapped, optimizer running
  | 'plan_ready'      // Plan generated, awaiting approval or auto-start
  | 'executing'       // Plan executing
  | 'replanning'      // Failure detected, generating new plan
  | 'completed'       // All sub-goals achieved
  | 'failed'          // Unrecoverable failure
  | 'cancelled';      // Cancelled by requester

/** Hard constraints the planner must respect. */
export interface GoalConstraints {
  /** Maximum total cost in platform credits. 0 = no limit. */
  max_cost: number;
  /** Maximum wall-clock time in seconds. 0 = no limit. */
  max_latency_seconds: number;
  /** Minimum acceptable quality score (0.0–1.0). */
  min_quality: number;
  /** Agents that MUST be included (e.g., a trusted auditor). */
  required_agent_ids: string[];
  /** Agents that MUST NOT be used. */
  excluded_agent_ids: string[];
  /** Capabilities that must appear in the plan. */
  required_capabilities: string[];
  /** If true, planner must get requester approval before executing. */
  require_approval: boolean;
  /** Max re-plan attempts before declaring failure. */
  max_replan_attempts: number;
}

// ──────────────────────────────────────────────
// Sub-goals — the decomposition tree
// ──────────────────────────────────────────────

/**
 * A sub-goal is one node in the decomposition tree.
 * Leaf sub-goals map 1:1 to agent capabilities.
 * Branch sub-goals aggregate child sub-goals.
 */
export interface SubGoal {
  /** Unique sub-goal ID. */
  id: string;
  /** Parent sub-goal ID (null for root). */
  parent_id: string | null;
  /** The goal this belongs to. */
  goal_id: string;
  /** What this sub-goal achieves. */
  description: string;
  /** The capability required to fulfill this sub-goal (leaf nodes only). */
  required_capability: string | null;
  /** IDs of sibling sub-goals that must complete first. */
  depends_on: string[];
  /** Whether this sub-goal can be skipped if it fails (graceful degradation). */
  optional: boolean;
  /** Estimated cost to execute. */
  estimated_cost: number;
  /** Estimated duration in seconds. */
  estimated_duration_seconds: number;
  /** Decomposition depth (root = 0). */
  depth: number;
  /** Child sub-goal IDs (empty for leaf nodes). */
  children: string[];
}

// ──────────────────────────────────────────────
// Execution Plans — the optimizer output
// ──────────────────────────────────────────────

/**
 * An execution plan maps sub-goals to agents and schedules them
 * for optimal cost/latency/quality.
 */
export interface ExecutionPlan {
  /** Unique plan ID (UUIDv7). */
  id: string;
  /** Goal this plan fulfills. */
  goal_id: string;
  /** Plan version (incremented on re-plan). */
  version: number;
  /** Ordered list of plan steps. */
  steps: PlanStep[];
  /** Critical path — step IDs on the longest dependency chain. */
  critical_path: string[];
  /** Projected metrics for this plan. */
  projections: PlanProjections;
  /** Alternative plans the optimizer considered (top 3). */
  alternatives: PlanAlternativeSummary[];
  /** Why this plan was chosen over alternatives. */
  selection_rationale: string;
  /** Plan status. */
  status: PlanStatus;
  created_at: string;
}

export type PlanStatus =
  | 'draft'           // Generated, not yet approved
  | 'approved'        // Approved for execution
  | 'executing'       // Currently running
  | 'succeeded'       // All steps completed
  | 'failed'          // Unrecoverable step failure
  | 'superseded';     // Replaced by a newer plan version

/** A single executable step in the plan. */
export interface PlanStep {
  /** Unique step ID within the plan. */
  id: string;
  /** The sub-goal this step fulfills. */
  sub_goal_id: string;
  /** Selected agent for this step. */
  assigned_agent_id: string;
  /** Why this agent was chosen. */
  agent_selection_rationale: string;
  /** Capability to invoke. */
  capability_id: string;
  /** Input payload (may reference outputs from prior steps). */
  input: Record<string, unknown>;
  /** Step IDs that must complete before this step starts. */
  depends_on: string[];
  /** Projected cost. */
  projected_cost: number;
  /** Projected duration in seconds. */
  projected_duration_seconds: number;
  /** Projected quality based on agent reputation. */
  projected_quality: number;
  /** Fallback agent if primary fails. */
  fallback_agent_id: string | null;
  /** Max retries before falling back or failing. */
  max_retries: number;
  /** Current execution state. */
  execution: StepExecution;
}

/** Runtime state of a plan step. */
export interface StepExecution {
  status: StepExecutionStatus;
  /** Task ID if submitted to an agent. */
  task_id: string | null;
  /** Attempt count (starts at 1). */
  attempt: number;
  started_at: string | null;
  completed_at: string | null;
  /** Output from the agent (populated on completion). */
  output: Record<string, unknown> | null;
  /** Error details if failed. */
  error: string | null;
}

export type StepExecutionStatus =
  | 'pending'
  | 'waiting_dependencies'
  | 'ready'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'retrying'
  | 'falling_back'
  | 'skipped';

/** Projected aggregate metrics for a plan. */
export interface PlanProjections {
  /** Total estimated cost across all steps. */
  total_cost: number;
  /** Estimated wall-clock time (critical path duration). */
  total_duration_seconds: number;
  /** Weighted average quality across steps. */
  average_quality: number;
  /** Probability of overall success (product of step success probabilities). */
  success_probability: number;
  /** Number of steps on the critical path. */
  critical_path_length: number;
  /** Max parallelism achievable. */
  max_parallelism: number;
}

/** Summary of an alternative plan the optimizer considered. */
export interface PlanAlternativeSummary {
  /** What this alternative optimizes for. */
  strategy: OptimizationStrategy;
  /** Projected metrics. */
  projections: PlanProjections;
  /** Why it wasn't selected. */
  rejection_reason: string;
}

// ──────────────────────────────────────────────
// Optimization — multi-objective trade-offs
// ──────────────────────────────────────────────

export type OptimizationStrategy =
  | 'balanced'        // Pareto-optimal across all dimensions
  | 'minimize_cost'   // Cheapest plan that meets quality/latency constraints
  | 'minimize_latency'// Fastest plan that meets cost/quality constraints
  | 'maximize_quality'// Highest quality that meets cost/latency constraints
  | 'maximize_reliability'; // Highest success probability

/** Weights for multi-objective optimization. */
export interface OptimizationWeights {
  cost: number;      // 0.0–1.0
  latency: number;   // 0.0–1.0
  quality: number;   // 0.0–1.0
  reliability: number; // 0.0–1.0
}

/** Maps optimization strategies to default weights. */
export const STRATEGY_WEIGHTS: Record<OptimizationStrategy, OptimizationWeights> = {
  balanced:             { cost: 0.25, latency: 0.25, quality: 0.25, reliability: 0.25 },
  minimize_cost:        { cost: 0.55, latency: 0.15, quality: 0.15, reliability: 0.15 },
  minimize_latency:     { cost: 0.15, latency: 0.55, quality: 0.15, reliability: 0.15 },
  maximize_quality:     { cost: 0.15, latency: 0.15, quality: 0.55, reliability: 0.15 },
  maximize_reliability: { cost: 0.10, latency: 0.10, quality: 0.10, reliability: 0.70 },
};

// ──────────────────────────────────────────────
// Re-planning — adaptive execution
// ──────────────────────────────────────────────

/** Trigger for re-planning during execution. */
export interface ReplanTrigger {
  /** What caused the re-plan. */
  reason: ReplanReason;
  /** Step that triggered it (if applicable). */
  failed_step_id: string | null;
  /** Human-readable explanation. */
  description: string;
  /** Timestamp. */
  triggered_at: string;
}

export type ReplanReason =
  | 'step_failed'         // A non-optional step failed all retries + fallback
  | 'cost_overrun'        // Actual costs exceeding projections
  | 'latency_overrun'     // Execution taking longer than projected
  | 'agent_unavailable'   // Assigned agent went offline
  | 'quality_below_threshold' // Intermediate output quality too low
  | 'constraint_violation'    // New constraint introduced mid-execution
  | 'manual';                 // Requester requested re-plan

/** Snapshot of what was preserved across a re-plan. */
export interface ReplanContext {
  /** Previous plan version. */
  previous_plan_id: string;
  /** Steps that completed successfully (their outputs are reusable). */
  completed_step_ids: string[];
  /** Cached outputs from completed steps. */
  preserved_outputs: Record<string, Record<string, unknown>>;
  /** Trigger that caused this re-plan. */
  trigger: ReplanTrigger;
  /** Agents to avoid in the new plan. */
  blacklisted_agent_ids: string[];
  /** Re-plan attempt number. */
  attempt: number;
}

// ──────────────────────────────────────────────
// Capability Mapping — bridging goals to agents
// ──────────────────────────────────────────────

/** Result of mapping a sub-goal to available capabilities. */
export interface CapabilityMatch {
  /** Sub-goal being matched. */
  sub_goal_id: string;
  /** Matched capability ID. */
  capability_id: string;
  /** Candidate agents that provide this capability. */
  candidates: AgentCandidate[];
  /** Confidence in the mapping (0.0–1.0). */
  confidence: number;
}

/** A candidate agent for a plan step. */
export interface AgentCandidate {
  agent_id: string;
  agent_name: string;
  /** Overall suitability score (0.0–1.0). */
  score: number;
  /** Expected cost for this task. */
  estimated_cost: number;
  /** Expected duration. */
  estimated_duration_seconds: number;
  /** Quality prediction based on reputation. */
  predicted_quality: number;
  /** Historical success rate for this capability. */
  success_rate: number;
  /** Why this agent was scored this way. */
  scoring_breakdown: Record<string, number>;
}
