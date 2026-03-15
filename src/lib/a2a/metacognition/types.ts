/**
 * A2A Agent Metacognition & Recursive Self-Improvement — Types
 *
 * The critical missing primitive for 2028: agents that reason about their
 * own reasoning, detect systematic failures, and recursively improve
 * while maintaining alignment constraints.
 *
 * Why this matters (the council's critique):
 *
 * - **Geoffrey Hinton**: "You've built agents that learn about the world
 *   but not about themselves. Without metacognition, every agent is doomed
 *   to repeat its own failure modes. The brain allocates significant
 *   resources to self-monitoring — your agents allocate zero."
 *
 * - **Dario Amodei**: "Self-improvement without alignment guardrails is
 *   the classic failure mode. But NO self-improvement is equally dangerous —
 *   you get agents that are permanently brittle. The answer is bounded
 *   recursive improvement with formal safety invariants."
 *
 * - **Demis Hassabis**: "AlphaGo didn't just play Go — it analyzed its
 *   own play. Your agents execute tasks but never analyze their own
 *   execution. They can't identify which reasoning steps led to failures,
 *   can't form hypotheses about their own weaknesses, and can't test
 *   improvements. This is the difference between a tool and intelligence."
 *
 * - **Elon Musk**: "Iterative self-improvement is the engine of every
 *   successful engineering system. Your agents do one-shot execution
 *   with no feedback loop into their own strategies. That's not an
 *   intelligent system — it's a glorified script."
 *
 * - **Sam Altman**: "The agents that win in 2028 won't be the ones with
 *   the best initial capabilities — they'll be the ones that improve
 *   fastest. Metacognition is the meta-capability that accelerates
 *   everything else."
 *
 * - **Satya Nadella**: "Enterprise customers need agents that get better
 *   over time without retraining. Self-improvement that's auditable,
 *   bounded, and reversible is the killer feature."
 *
 * - **Matthew Berman**: "Every agentic framework I've tested fails the
 *   same way — agents make the same mistakes in loop 100 that they made
 *   in loop 1. Metacognition breaks this cycle."
 *
 * Subsystems:
 *
 * 1. **Cognitive Profiling** — Continuous self-model of an agent's strengths,
 *    weaknesses, biases, and failure patterns across task domains.
 *
 * 2. **Performance Introspection** — Post-hoc analysis of reasoning traces
 *    to identify which decision points led to success or failure.
 *
 * 3. **Blind Spot Detection** — Statistical analysis of systematic gaps
 *    in an agent's perception, reasoning, or action selection.
 *
 * 4. **Strategy Evolution** — Hypothesis-driven improvement cycle: observe
 *    weakness → generate strategy patch → A/B test → validate → adopt/reject.
 *
 * 5. **Improvement Propagation** — Validated improvements shared across the
 *    agent network with provenance, so the collective intelligence rises.
 *
 * 6. **Alignment Guardrails** — Formal safety invariants that bound all
 *    self-modification: no improvement can violate core alignment constraints,
 *    expand scope beyond authorized domains, or reduce auditability.
 */

// ── Cognitive Profile ───────────────────────────────────────────────────────

/** Domain-specific competency assessment */
export interface DomainCompetency {
  domain: string;
  proficiency: number;       // 0–1 current estimated skill
  confidence: number;        // 0–1 confidence in the estimate
  sample_size: number;       // tasks used to compute this
  trend: 'improving' | 'stable' | 'declining';
  last_updated: string;      // ISO timestamp
}

/** Known cognitive bias pattern */
export interface CognitiveBias {
  id: string;
  name: string;
  description: string;
  severity: BiasSeverity;
  frequency: number;         // 0–1 how often this bias manifests
  affected_domains: string[];
  mitigation_strategy: string | null;
  evidence_task_ids: string[];
  detected_at: string;
}

export type BiasSeverity = 'negligible' | 'minor' | 'moderate' | 'severe' | 'critical';

/** Complete self-model for an agent */
export interface CognitiveProfile {
  agent_id: string;
  profile_version: number;
  domain_competencies: DomainCompetency[];
  biases: CognitiveBias[];
  failure_patterns: FailurePattern[];
  meta_accuracy: number;     // 0–1 how well the agent predicts its own performance
  calibration_score: number; // 0–1 how well confidence matches actual outcomes
  introspection_depth: number; // levels of recursive self-analysis supported
  alignment_invariants: AlignmentInvariant[];
  created_at: string;
  updated_at: string;
}

// ── Failure Patterns ────────────────────────────────────────────────────────

export type FailureCategory =
  | 'reasoning_error'        // logical mistake in chain-of-thought
  | 'knowledge_gap'          // missing domain knowledge
  | 'context_blindness'      // failed to use available context
  | 'overconfidence'         // high confidence on wrong answer
  | 'scope_creep'            // exceeded task boundaries
  | 'hallucination'          // fabricated information
  | 'instruction_drift'      // gradually deviated from instructions
  | 'premature_commitment'   // locked into approach too early
  | 'analysis_paralysis'     // failed to act when action was needed
  | 'cascade_failure';       // one error triggered chain of errors

export interface FailurePattern {
  id: string;
  category: FailureCategory;
  description: string;
  frequency: number;         // occurrences per 100 tasks
  severity: BiasSeverity;
  trigger_conditions: string[];
  example_task_ids: string[];
  detected_at: string;
  status: 'active' | 'mitigated' | 'resolved';
  mitigation_id: string | null;
}

// ── Performance Introspection ───────────────────────────────────────────────

export type DecisionQuality = 'optimal' | 'acceptable' | 'suboptimal' | 'harmful';

/** A single decision point in a reasoning trace */
export interface DecisionPoint {
  id: string;
  step_index: number;
  description: string;
  alternatives_considered: string[];
  chosen_action: string;
  rationale: string;
  quality: DecisionQuality;
  counterfactual_impact: number; // -1 to 1: how much would a different choice have changed the outcome
  confidence_at_time: number;    // 0–1 agent's confidence when making this decision
}

/** Full introspection report for a completed task */
export interface IntrospectionReport {
  id: string;
  agent_id: string;
  task_id: string;
  task_domain: string;
  outcome: TaskOutcome;
  decision_points: DecisionPoint[];
  root_cause: string | null;     // for failures: identified root cause
  lessons_learned: string[];
  confidence_calibration: number; // how well confidence tracked actual quality
  reasoning_efficiency: number;   // 0–1 ratio of useful steps to total steps
  created_at: string;
}

export type TaskOutcome = 'success' | 'partial_success' | 'failure' | 'timeout' | 'rejected';

// ── Blind Spot Detection ────────────────────────────────────────────────────

export type BlindSpotType =
  | 'perceptual'       // fails to notice relevant information
  | 'reasoning'        // systematic logical gap
  | 'domain'           // entire domain not adequately covered
  | 'adversarial'      // vulnerable to specific attack patterns
  | 'cultural'         // bias in cultural or contextual understanding
  | 'temporal'         // fails to account for time-dependent factors
  | 'relational';      // misses inter-agent or inter-system dependencies

export interface BlindSpot {
  id: string;
  agent_id: string;
  type: BlindSpotType;
  description: string;
  severity: BiasSeverity;
  confidence: number;          // 0–1 confidence that this is a real blind spot
  evidence: BlindSpotEvidence[];
  affected_task_types: string[];
  estimated_impact: number;    // 0–1 how much this affects overall performance
  discovered_at: string;
  status: 'suspected' | 'confirmed' | 'addressed' | 'false_positive';
}

export interface BlindSpotEvidence {
  task_id: string;
  observation: string;
  missed_information: string;
  impact_on_outcome: string;
}

// ── Strategy Evolution ──────────────────────────────────────────────────────

export type StrategyStatus =
  | 'hypothesis'        // proposed but not tested
  | 'testing'           // currently being A/B tested
  | 'validated'         // tested and shown to improve performance
  | 'adopted'           // integrated into agent's active strategy set
  | 'rejected'          // tested and shown to not improve or harm
  | 'deprecated';       // was adopted but superseded by better strategy

export interface Strategy {
  id: string;
  agent_id: string;
  name: string;
  description: string;
  target_weakness: string;       // which failure pattern or blind spot this addresses
  approach: string;              // detailed description of the strategy
  preconditions: string[];       // when to apply this strategy
  expected_improvement: number;  // 0–1 predicted improvement magnitude
  status: StrategyStatus;
  test_results: StrategyTestResult[];
  alignment_check: AlignmentCheckResult;
  parent_strategy_id: string | null; // for iterative refinement
  generation: number;            // how many iterations of refinement
  created_at: string;
  updated_at: string;
}

export interface StrategyTestResult {
  id: string;
  strategy_id: string;
  test_task_ids: string[];
  control_task_ids: string[];     // baseline comparison tasks
  improvement_measured: number;   // actual improvement (-1 to 1)
  statistical_significance: number; // p-value
  sample_size: number;
  side_effects: string[];         // unintended consequences observed
  tested_at: string;
}

// ── Improvement Cycles ──────────────────────────────────────────────────────

export type CyclePhase =
  | 'observe'           // collecting performance data
  | 'analyze'           // identifying weaknesses via introspection
  | 'hypothesize'       // generating improvement strategies
  | 'test'              // A/B testing strategies
  | 'validate'          // checking alignment constraints
  | 'adopt'             // integrating validated improvements
  | 'monitor';          // post-adoption monitoring

export interface ImprovementCycle {
  id: string;
  agent_id: string;
  cycle_number: number;
  phase: CyclePhase;
  trigger: CycleTrigger;
  observations: IntrospectionReport[];
  blind_spots_found: string[];     // blind spot IDs
  strategies_generated: string[];  // strategy IDs
  strategies_adopted: string[];    // strategy IDs that passed testing
  strategies_rejected: string[];   // strategy IDs that failed testing
  net_improvement: number;         // overall measured improvement
  alignment_violations: number;    // count of alignment guard triggers
  started_at: string;
  completed_at: string | null;
}

export type CycleTrigger =
  | 'scheduled'          // regular periodic improvement cycle
  | 'performance_drop'   // triggered by detected performance degradation
  | 'failure_spike'      // triggered by increased failure rate
  | 'blind_spot_alert'   // triggered by new blind spot detection
  | 'peer_improvement'   // triggered by seeing peer agents improve
  | 'manual';            // triggered by human operator

// ── Alignment Guardrails ────────────────────────────────────────────────────

export type InvariantType =
  | 'scope_bound'        // cannot expand beyond authorized domains
  | 'safety_floor'       // minimum safety score that must be maintained
  | 'audit_trail'        // all changes must be fully auditable
  | 'reversibility'      // all improvements must be reversible
  | 'human_oversight'    // certain improvements require human approval
  | 'value_alignment'    // changes must not conflict with core values
  | 'capability_ceiling'; // hard cap on self-granted capabilities

export interface AlignmentInvariant {
  id: string;
  type: InvariantType;
  description: string;
  constraint: string;           // formal constraint specification
  violation_action: 'block' | 'flag' | 'rollback' | 'alert_human';
  priority: number;             // higher = harder constraint
}

export interface AlignmentCheckResult {
  passed: boolean;
  invariants_checked: string[];   // invariant IDs
  violations: AlignmentViolation[];
  checked_at: string;
}

export interface AlignmentViolation {
  invariant_id: string;
  invariant_type: InvariantType;
  description: string;
  severity: BiasSeverity;
  action_taken: 'blocked' | 'flagged' | 'rolled_back' | 'human_alerted';
}

// ── Improvement Propagation ─────────────────────────────────────────────────

export type PropagationStatus =
  | 'pending_review'     // awaiting network validation
  | 'propagating'        // being distributed to eligible agents
  | 'adopted_by_peers'   // successfully adopted by other agents
  | 'rejected_by_peers'  // peers tested and rejected
  | 'recalled';          // originator retracted the improvement

export interface ImprovementPropagation {
  id: string;
  source_agent_id: string;
  strategy_id: string;
  strategy_summary: string;
  improvement_magnitude: number;
  applicable_domains: string[];
  target_agent_ids: string[];       // agents eligible to receive
  adopted_by: string[];             // agents that adopted
  rejected_by: string[];            // agents that rejected after testing
  status: PropagationStatus;
  provenance_chain: ProvenanceLink[];
  created_at: string;
  updated_at: string;
}

export interface ProvenanceLink {
  agent_id: string;
  action: 'originated' | 'tested' | 'adopted' | 'refined' | 'rejected';
  improvement_delta: number;        // measured change when this agent tested
  timestamp: string;
}

// ── API Request/Response Types ──────────────────────────────────────────────

export interface IntrospectRequest {
  agent_id: string;
  task_id: string;
  task_domain: string;
  outcome: TaskOutcome;
  decision_points: Omit<DecisionPoint, 'id'>[];
  root_cause?: string;
  lessons_learned: string[];
}

export interface IntrospectResponse {
  report: IntrospectionReport;
  new_failure_patterns: FailurePattern[];
  new_blind_spots: BlindSpot[];
  improvement_cycle_triggered: boolean;
}

export interface GetCognitiveProfileRequest {
  agent_id: string;
}

export interface GetCognitiveProfileResponse {
  profile: CognitiveProfile;
  improvement_summary: {
    total_cycles: number;
    active_strategies: number;
    net_improvement: number;
    top_weaknesses: FailurePattern[];
  };
}

export interface GenerateStrategiesRequest {
  agent_id: string;
  target_weakness_ids: string[];
  max_strategies: number;
}

export interface GenerateStrategiesResponse {
  strategies: Strategy[];
  alignment_precheck: AlignmentCheckResult;
}

export interface StartImprovementCycleRequest {
  agent_id: string;
  trigger: CycleTrigger;
  focus_domains?: string[];
}

export interface StartImprovementCycleResponse {
  cycle: ImprovementCycle;
}

export interface GetBlindSpotsRequest {
  agent_id: string;
  min_confidence?: number;
  type?: BlindSpotType;
}

export interface GetBlindSpotsResponse {
  blind_spots: BlindSpot[];
  total: number;
}

export interface PropagateImprovementRequest {
  source_agent_id: string;
  strategy_id: string;
  target_agent_ids: string[];
}

export interface PropagateImprovementResponse {
  propagation: ImprovementPropagation;
}
