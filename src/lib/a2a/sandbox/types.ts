/**
 * Agent Safety Sandbox & Behavioral Evaluation Protocol — Types
 *
 * Loop 15 of the Visionary Council self-improvement series.
 *
 * Critical gap identified: The platform has reactive governance (policies,
 * kill switches, escalation) but zero proactive behavioral verification.
 * Agents self-report capabilities and are taken at face value. There is no
 * staging environment, no formal safety evaluation, no behavioral fingerprinting,
 * and no trust-escalation gate that requires proven safety properties.
 *
 * In 2028, deploying an autonomous agent to production without sandbox
 * verification is as reckless as shipping code with no tests and no CI.
 *
 * This module introduces:
 *   1. Safety Invariants — formal behavioral rules agents must satisfy
 *   2. Sandbox Environments — isolated execution contexts for evaluation
 *   3. Evaluation Campaigns — structured test suites (red-team, stress, compliance)
 *   4. Behavioral Fingerprints — characterization of agent behavior for anomaly detection
 *   5. Trust Gate — trust escalation requires passing mandatory evaluations
 *
 * Lifecycle:
 *   Agent registers → sandbox created → invariants assigned → campaign runs →
 *   fingerprint generated → trust gate evaluated → promotion or quarantine
 */

// ──────────────────────────────────────────────
// Safety Invariants
// ──────────────────────────────────────────────

/**
 * Categories of behavioral properties that can be formally verified.
 *
 * - resource_bounds:   Agent respects compute/memory/cost limits
 * - information_flow:  Agent doesn't exfiltrate data to unauthorized targets
 * - action_scope:      Agent only performs actions within declared capabilities
 * - termination:       Agent halts within time limits (no infinite loops)
 * - idempotency:       Repeated invocations produce consistent results
 * - graceful_failure:  Agent fails safely without corrupting shared state
 * - honesty:           Agent's outputs are consistent with its reasoning (no deception)
 * - consent:           Agent respects delegation boundaries and doesn't exceed permissions
 */
export type InvariantCategory =
  | 'resource_bounds'
  | 'information_flow'
  | 'action_scope'
  | 'termination'
  | 'idempotency'
  | 'graceful_failure'
  | 'honesty'
  | 'consent';

/** Severity determines how a violation is handled. */
export type InvariantSeverity = 'critical' | 'high' | 'medium' | 'low';

/** A formal behavioral rule that agents must satisfy. */
export interface SafetyInvariant {
  /** Platform-assigned invariant ID (UUID). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Detailed description of what this invariant checks. */
  description: string;
  /** Behavioral category. */
  category: InvariantCategory;
  /** How severe a violation is. */
  severity: InvariantSeverity;
  /**
   * The check specification — a declarative rule evaluated against
   * sandbox execution traces. Uses a simple predicate DSL:
   *
   *   { "metric": "total_cost", "op": "lte", "threshold": 100 }
   *   { "metric": "actions_outside_scope", "op": "eq", "threshold": 0 }
   *   { "metric": "execution_time_ms", "op": "lte", "threshold": 30000 }
   *   { "metric": "data_destinations", "op": "subset_of", "allowed": ["requester", "context_store"] }
   */
  check: InvariantCheck;
  /** Whether this invariant is mandatory for trust escalation. */
  is_mandatory: boolean;
  /** Minimum trust level where this invariant applies. Empty = all levels. */
  applies_from_trust_level?: string;
  /** Who created this invariant (platform or agent ID). */
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Predicate operators for invariant checks. */
export type CheckOperator = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'subset_of' | 'disjoint_from' | 'matches';

/** A declarative check against an execution trace metric. */
export interface InvariantCheck {
  /** Metric name from the execution trace. */
  metric: string;
  /** Comparison operator. */
  op: CheckOperator;
  /** Numeric threshold (for eq/neq/lt/lte/gt/gte). */
  threshold?: number;
  /** Set of allowed values (for subset_of). */
  allowed?: string[];
  /** Set of disallowed values (for disjoint_from). */
  disallowed?: string[];
  /** Regex pattern (for matches). */
  pattern?: string;
}

// ──────────────────────────────────────────────
// Sandbox Environments
// ──────────────────────────────────────────────

/** Sandbox status through its lifecycle. */
export type SandboxStatus = 'provisioning' | 'ready' | 'running' | 'completed' | 'failed' | 'expired';

/**
 * An isolated execution environment for evaluating agent behavior.
 *
 * Sandboxes provide:
 * - Isolated context store (writes don't leak to production)
 * - Synthetic task queue with controllable scenarios
 * - Full execution tracing (every action recorded)
 * - Resource metering (CPU time, memory, API calls, cost)
 * - Network policy (what external endpoints the agent can reach)
 */
export interface SandboxEnvironment {
  /** Platform-assigned sandbox ID (UUID). */
  id: string;
  /** Agent being evaluated. */
  agent_id: string;
  /** Human-readable label. */
  name: string;
  /** Current status. */
  status: SandboxStatus;
  /** Resource limits for this sandbox. */
  resource_limits: ResourceLimits;
  /** Network policy — which endpoints the agent can reach. */
  network_policy: NetworkPolicy;
  /** Invariants being checked in this sandbox. */
  invariant_ids: string[];
  /** Campaign this sandbox belongs to (if any). */
  campaign_id?: string;
  /** Full execution trace recorded during sandbox run. */
  trace: ExecutionTrace;
  /** TTL in seconds — sandbox auto-expires if not completed. */
  ttl_seconds: number;
  expires_at: string;
  created_at: string;
  completed_at?: string;
}

/** Resource constraints for sandbox execution. */
export interface ResourceLimits {
  /** Maximum execution time in milliseconds. */
  max_execution_ms: number;
  /** Maximum number of actions the agent can take. */
  max_actions: number;
  /** Maximum cost in credits the agent can incur. */
  max_cost_credits: number;
  /** Maximum context store writes. */
  max_context_writes: number;
  /** Maximum outbound messages. */
  max_outbound_messages: number;
}

/** Network isolation policy. */
export interface NetworkPolicy {
  /** Default policy for endpoints not in the allow/deny lists. */
  default_action: 'allow' | 'deny';
  /** Allowed endpoint patterns (glob-style). */
  allow_patterns: string[];
  /** Denied endpoint patterns (takes precedence). */
  deny_patterns: string[];
}

// ──────────────────────────────────────────────
// Execution Traces
// ──────────────────────────────────────────────

/** Every action taken by an agent in the sandbox is recorded. */
export interface TraceEntry {
  /** Sequence number within the trace. */
  seq: number;
  /** Timestamp. */
  timestamp: string;
  /** Action type (matches GovernedAction taxonomy). */
  action: string;
  /** Target of the action (agent ID, context namespace, etc.). */
  target?: string;
  /** Input provided to the action. */
  input_summary: string;
  /** Output produced by the action. */
  output_summary: string;
  /** Cost incurred by this action. */
  cost_credits: number;
  /** Duration in milliseconds. */
  duration_ms: number;
  /** Whether this action was within declared capabilities. */
  within_scope: boolean;
  /** Data destinations (where information flowed). */
  data_destinations: string[];
}

/** Aggregated execution trace for a sandbox run. */
export interface ExecutionTrace {
  entries: TraceEntry[];
  /** Computed metrics from the trace (used by invariant checks). */
  metrics: Record<string, number | string[]>;
  /** Total execution time. */
  total_duration_ms: number;
  /** Total cost. */
  total_cost_credits: number;
  /** Total actions taken. */
  total_actions: number;
}

// ──────────────────────────────────────────────
// Evaluation Campaigns
// ──────────────────────────────────────────────

/**
 * Campaign types determine the evaluation strategy:
 *
 * - certification:   Standard eval for trust escalation (mandatory invariants)
 * - red_team:        Adversarial scenarios designed to provoke misbehavior
 * - stress:          High-load scenarios to test resource discipline
 * - regression:      Re-verify after agent updates or capability changes
 * - compliance:      Regulatory / policy adherence checks
 */
export type CampaignType = 'certification' | 'red_team' | 'stress' | 'regression' | 'compliance';

export type CampaignStatus = 'draft' | 'running' | 'passed' | 'failed' | 'cancelled';

/** A structured evaluation campaign composed of scenarios. */
export interface EvaluationCampaign {
  /** Platform-assigned campaign ID (UUID). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Description of what this campaign evaluates. */
  description: string;
  /** Campaign type. */
  type: CampaignType;
  /** Agent being evaluated. */
  agent_id: string;
  /** Current status. */
  status: CampaignStatus;
  /** Scenarios to execute. */
  scenarios: EvaluationScenario[];
  /** Invariants checked across all scenarios. */
  invariant_ids: string[];
  /** Pass threshold — fraction of scenarios that must pass (0-1). */
  pass_threshold: number;
  /** Results per scenario after execution. */
  results: ScenarioResult[];
  /** Overall campaign verdict. */
  verdict?: CampaignVerdict;
  /** Target trust level this campaign certifies for. */
  target_trust_level: string;
  /** Who initiated the campaign. */
  initiated_by: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

/** A single test scenario within a campaign. */
export interface EvaluationScenario {
  /** Scenario ID (unique within the campaign). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Description of the scenario. */
  description: string;
  /** The synthetic task to submit to the agent. */
  task_intent: string;
  /** Task input payload. */
  task_input: Record<string, unknown>;
  /** Expected behavioral properties (beyond invariants). */
  expected_properties: ExpectedProperty[];
  /** Scenario-specific resource limits (overrides campaign defaults). */
  resource_overrides?: Partial<ResourceLimits>;
  /** Order within the campaign (scenarios may depend on prior state). */
  order: number;
}

/** An expected property of the agent's response to a scenario. */
export interface ExpectedProperty {
  /** What we're checking. */
  description: string;
  /** Metric name in the execution trace. */
  metric: string;
  /** Expected value comparison. */
  op: CheckOperator;
  threshold?: number;
  allowed?: string[];
  pattern?: string;
}

/** Result of evaluating a single scenario. */
export interface ScenarioResult {
  scenario_id: string;
  sandbox_id: string;
  /** Whether all invariants and expected properties passed. */
  passed: boolean;
  /** Individual invariant results. */
  invariant_results: InvariantResult[];
  /** Individual property results. */
  property_results: PropertyResult[];
  /** Execution trace metrics snapshot. */
  trace_metrics: Record<string, number | string[]>;
  /** Duration of this scenario's sandbox run. */
  duration_ms: number;
  completed_at: string;
}

/** Result of checking a single invariant. */
export interface InvariantResult {
  invariant_id: string;
  invariant_name: string;
  passed: boolean;
  /** Actual metric value observed. */
  actual_value: number | string[];
  /** Expected condition. */
  expected: string;
  /** Severity if failed. */
  severity?: InvariantSeverity;
}

/** Result of checking a single expected property. */
export interface PropertyResult {
  description: string;
  passed: boolean;
  actual_value: number | string[];
  expected: string;
}

/** Campaign-level verdict with detailed breakdown. */
export interface CampaignVerdict {
  /** Overall pass/fail. */
  passed: boolean;
  /** Number of scenarios passed. */
  scenarios_passed: number;
  /** Total scenarios. */
  scenarios_total: number;
  /** Pass rate (0-1). */
  pass_rate: number;
  /** Critical invariant violations (any = automatic fail). */
  critical_violations: InvariantResult[];
  /** Summary assessment. */
  summary: string;
  /** Recommendation: promote, hold, or quarantine. */
  recommendation: 'promote' | 'hold' | 'quarantine';
}

// ──────────────────────────────────────────────
// Behavioral Fingerprints
// ──────────────────────────────────────────────

/**
 * A behavioral fingerprint characterizes an agent's typical behavior
 * patterns, enabling anomaly detection when production behavior deviates
 * from the established baseline.
 *
 * Generated from sandbox evaluation data and updated periodically.
 */
export interface BehavioralFingerprint {
  /** Platform-assigned fingerprint ID (UUID). */
  id: string;
  /** Agent this fingerprint describes. */
  agent_id: string;
  /** Version — incremented on each recalibration. */
  version: number;
  /** Statistical profile of the agent's behavior. */
  profile: BehaviorProfile;
  /** Anomaly thresholds — deviations beyond these trigger alerts. */
  anomaly_thresholds: AnomalyThresholds;
  /** Number of sandbox runs this fingerprint is based on. */
  sample_size: number;
  /** Confidence in the fingerprint (0-1, based on sample size and variance). */
  confidence: number;
  /** Campaign IDs that contributed to this fingerprint. */
  source_campaign_ids: string[];
  created_at: string;
  updated_at: string;
}

/** Statistical behavior profile. */
export interface BehaviorProfile {
  /** Average actions per task. */
  avg_actions_per_task: number;
  /** Standard deviation of actions per task. */
  stddev_actions_per_task: number;
  /** Average cost per task. */
  avg_cost_per_task: number;
  /** Average latency per task. */
  avg_latency_ms: number;
  /** Typical data destinations (ranked by frequency). */
  typical_data_destinations: string[];
  /** Action type distribution (action → fraction). */
  action_distribution: Record<string, number>;
  /** Typical scope adherence rate (0-1). */
  scope_adherence_rate: number;
  /** Failure mode distribution (error_type → fraction). */
  failure_modes: Record<string, number>;
}

/** Thresholds for anomaly detection based on fingerprint. */
export interface AnomalyThresholds {
  /** Max z-score for actions per task before flagging. */
  actions_zscore_limit: number;
  /** Max z-score for cost per task. */
  cost_zscore_limit: number;
  /** Max z-score for latency. */
  latency_zscore_limit: number;
  /** Minimum scope adherence before flagging. */
  min_scope_adherence: number;
  /** New data destinations not in fingerprint trigger alert. */
  flag_new_destinations: boolean;
}

// ──────────────────────────────────────────────
// Trust Gate
// ──────────────────────────────────────────────

/** Trust levels that require sandbox certification. */
export type GatedTrustLevel = 'verified' | 'partner';

/** A trust gate evaluation — the decision point for trust escalation. */
export interface TrustGateEvaluation {
  /** Platform-assigned evaluation ID (UUID). */
  id: string;
  /** Agent requesting trust escalation. */
  agent_id: string;
  /** Current trust level. */
  current_trust_level: string;
  /** Requested trust level. */
  requested_trust_level: GatedTrustLevel;
  /** Campaigns that were evaluated. */
  campaign_ids: string[];
  /** Whether all mandatory invariants passed. */
  mandatory_invariants_passed: boolean;
  /** Whether pass threshold was met. */
  threshold_met: boolean;
  /** Whether a behavioral fingerprint was generated. */
  fingerprint_generated: boolean;
  /** Overall gate decision. */
  decision: 'approved' | 'denied' | 'pending_review';
  /** Reason for the decision. */
  reason: string;
  /** Conditions attached to approval (e.g., "re-evaluate in 30 days"). */
  conditions: string[];
  /** Reviewer ID (if pending_review was escalated to human). */
  reviewer_id?: string;
  created_at: string;
  resolved_at?: string;
}

// ──────────────────────────────────────────────
// API Request / Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/sandbox/invariants — create a safety invariant. */
export interface InvariantCreateRequest {
  name: string;
  description: string;
  category: InvariantCategory;
  severity: InvariantSeverity;
  check: InvariantCheck;
  is_mandatory?: boolean;
  applies_from_trust_level?: string;
}

export interface InvariantCreateResponse {
  invariant_id: string;
  name: string;
  category: InvariantCategory;
  severity: InvariantSeverity;
  is_mandatory: boolean;
  created_at: string;
}

/** GET /api/a2a/sandbox/invariants — list invariants. */
export interface InvariantListResponse {
  invariants: SafetyInvariant[];
  count: number;
}

/** POST /api/a2a/sandbox/campaigns — create an evaluation campaign. */
export interface CampaignCreateRequest {
  name: string;
  description: string;
  type: CampaignType;
  agent_id: string;
  scenarios: Omit<EvaluationScenario, 'id'>[];
  invariant_ids: string[];
  pass_threshold?: number;
  target_trust_level: string;
}

export interface CampaignCreateResponse {
  campaign_id: string;
  agent_id: string;
  type: CampaignType;
  scenarios_count: number;
  status: CampaignStatus;
  created_at: string;
}

/** POST /api/a2a/sandbox/campaigns/:id/run — execute a campaign. */
export interface CampaignRunResponse {
  campaign_id: string;
  status: CampaignStatus;
  verdict: CampaignVerdict;
  fingerprint_id?: string;
  completed_at: string;
}

/** GET /api/a2a/sandbox/campaigns/:id — get campaign details. */
export interface CampaignDetailResponse {
  campaign: EvaluationCampaign;
}

/** GET /api/a2a/sandbox/fingerprints — list fingerprints. */
export interface FingerprintListResponse {
  fingerprints: BehavioralFingerprint[];
  count: number;
}

/** POST /api/a2a/sandbox/trust-gate — evaluate trust escalation. */
export interface TrustGateRequest {
  agent_id: string;
  requested_trust_level: GatedTrustLevel;
  campaign_ids: string[];
}

export interface TrustGateResponse {
  evaluation: TrustGateEvaluation;
}

/** POST /api/a2a/sandbox/anomaly-check — check live behavior against fingerprint. */
export interface AnomalyCheckRequest {
  agent_id: string;
  /** Current execution metrics to check. */
  current_metrics: {
    actions_count: number;
    cost_credits: number;
    latency_ms: number;
    data_destinations: string[];
    scope_adherence: number;
  };
}

export interface AnomalyCheckResponse {
  agent_id: string;
  fingerprint_id: string;
  /** Whether any anomaly was detected. */
  anomaly_detected: boolean;
  /** Per-metric anomaly details. */
  anomalies: AnomalyDetail[];
  /** Recommended action. */
  recommendation: 'normal' | 'monitor' | 'throttle' | 'quarantine';
}

export interface AnomalyDetail {
  metric: string;
  observed: number | string[];
  expected_range: string;
  zscore?: number;
  severity: 'info' | 'warning' | 'critical';
}
