/**
 * Temporal Intelligence & Causal Reasoning Engine
 *
 * Gives agents the ability to reason about time, causality, and consequences.
 * Agents can build causal models of the ecosystem, predict future states,
 * plan across temporal horizons, and coordinate temporally-aware workflows.
 *
 * Core concepts:
 * - CausalGraph: directed graph where edges represent causal relationships
 * - TemporalEvent: timestamped, typed events with causal provenance
 * - Counterfactual: "what-if" reasoning about alternate timelines
 * - TemporalPolicy: time-aware constraints and scheduling rules
 * - FutureProjection: probabilistic prediction of future ecosystem state
 */

// ---------------------------------------------------------------------------
// Temporal primitives
// ---------------------------------------------------------------------------

export type TemporalPrecision = 'millisecond' | 'second' | 'minute' | 'hour' | 'day';

export interface TemporalWindow {
  start: string; // ISO-8601
  end: string;
  precision: TemporalPrecision;
}

export interface TemporalCoordinate {
  wallClock: string; // ISO-8601
  logicalClock: number; // Lamport-style counter for causal ordering
  vectorClock: Record<string, number>; // per-agent logical clocks
}

// ---------------------------------------------------------------------------
// Causal Graph
// ---------------------------------------------------------------------------

export type CausalRelation =
  | 'causes'
  | 'enables'
  | 'prevents'
  | 'inhibits'
  | 'amplifies'
  | 'attenuates'
  | 'triggers'
  | 'correlates'
  | 'mediates'
  | 'moderates';

export interface CausalNode {
  id: string;
  agentId: string;
  label: string;
  type: 'action' | 'state' | 'event' | 'condition' | 'outcome';
  timestamp: TemporalCoordinate;
  properties: Record<string, unknown>;
  confidence: number; // 0-1 how certain we are this node exists
  observed: boolean; // true if directly observed, false if inferred
}

export interface CausalEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relation: CausalRelation;
  strength: number; // 0-1 causal strength
  delay: number; // expected ms between cause and effect
  delayVariance: number; // uncertainty in delay
  confidence: number; // 0-1 how certain this causal link is
  evidence: CausalEvidence[];
}

export interface CausalEvidence {
  type: 'observation' | 'intervention' | 'counterfactual' | 'statistical' | 'expert';
  source: string;
  timestamp: string;
  weight: number;
  description: string;
}

export interface CausalGraph {
  id: string;
  name: string;
  nodes: CausalNode[];
  edges: CausalEdge[];
  createdAt: string;
  updatedAt: string;
  owner: string; // agent ID
  collaborators: string[];
  version: number;
  // Structural metadata
  confounders: string[]; // node IDs that are known confounders
  interventionTargets: string[]; // nodes that can be intervened on
  rootCauses: string[]; // nodes with no incoming causal edges
  terminalOutcomes: string[]; // nodes with no outgoing causal edges
}

// ---------------------------------------------------------------------------
// Temporal Events
// ---------------------------------------------------------------------------

export type TemporalEventType =
  | 'agent_action'
  | 'state_change'
  | 'task_lifecycle'
  | 'resource_change'
  | 'communication'
  | 'failure'
  | 'recovery'
  | 'policy_trigger'
  | 'external_signal';

export interface TemporalEvent {
  id: string;
  type: TemporalEventType;
  agentId: string;
  timestamp: TemporalCoordinate;
  payload: Record<string, unknown>;
  causalParents: string[]; // event IDs that caused this event
  causalChildren: string[]; // event IDs caused by this event
  tags: string[];
  // Temporal context
  duration: number | null; // ms, null for instantaneous
  deadline: string | null; // ISO-8601, if this event has a time constraint
  periodicPattern: PeriodicPattern | null;
}

export interface PeriodicPattern {
  frequency: number; // occurrences per unit
  unit: 'second' | 'minute' | 'hour' | 'day' | 'week';
  confidence: number;
  lastSeen: string;
  nextExpected: string;
}

// ---------------------------------------------------------------------------
// Counterfactual reasoning
// ---------------------------------------------------------------------------

export interface Counterfactual {
  id: string;
  graphId: string;
  question: string; // natural-language "what if" question
  intervention: CounterfactualIntervention;
  baselineOutcome: CounterfactualOutcome;
  alternateOutcome: CounterfactualOutcome;
  causalPathsAffected: string[][]; // arrays of node ID sequences
  confidence: number;
  computedAt: string;
}

export interface CounterfactualIntervention {
  targetNodeId: string;
  type: 'set' | 'remove' | 'modify' | 'delay' | 'accelerate';
  value: unknown;
  description: string;
}

export interface CounterfactualOutcome {
  affectedNodes: Array<{
    nodeId: string;
    originalValue: unknown;
    projectedValue: unknown;
    changeConfidence: number;
  }>;
  probabilityOfOccurrence: number;
  expectedTimeline: TemporalWindow;
  sideEffects: string[];
}

// ---------------------------------------------------------------------------
// Future Projections
// ---------------------------------------------------------------------------

export type ProjectionMethod =
  | 'causal_propagation' // follow causal edges forward
  | 'pattern_extrapolation' // extend observed periodic patterns
  | 'monte_carlo' // stochastic simulation of causal graph
  | 'bayesian_update' // posterior update from new evidence
  | 'ensemble'; // weighted combination of methods

export interface FutureProjection {
  id: string;
  graphId: string;
  method: ProjectionMethod;
  horizon: TemporalWindow;
  predictions: Prediction[];
  confidence: number; // overall confidence
  computedAt: string;
  expiresAt: string; // projection becomes stale
  assumptions: string[];
}

export interface Prediction {
  nodeId: string;
  predictedState: unknown;
  probability: number;
  confidenceInterval: { lower: number; upper: number };
  expectedTime: string; // ISO-8601
  timeUncertainty: number; // ms
  causalChain: string[]; // node IDs tracing why this is predicted
  sensitivity: SensitivityFactor[];
}

export interface SensitivityFactor {
  nodeId: string;
  edgeId: string;
  impact: number; // -1 to 1, how much this factor influences the prediction
  description: string;
}

// ---------------------------------------------------------------------------
// Temporal Policies
// ---------------------------------------------------------------------------

export type TemporalConstraintType =
  | 'deadline' // must complete by time T
  | 'embargo' // cannot start before time T
  | 'rate_limit' // max N occurrences per time window
  | 'cooldown' // minimum time between occurrences
  | 'window' // only allowed during time window
  | 'sequence' // must happen in causal order
  | 'concurrency' // max N simultaneous executions
  | 'freshness'; // result must be younger than T

export interface TemporalConstraint {
  id: string;
  type: TemporalConstraintType;
  target: string; // agent ID, task type, or resource
  parameters: Record<string, unknown>;
  priority: number;
  enforced: boolean; // hard constraint vs advisory
  violationAction: 'block' | 'warn' | 'log' | 'escalate';
}

export interface TemporalPolicy {
  id: string;
  name: string;
  description: string;
  constraints: TemporalConstraint[];
  scope: {
    agents: string[] | '*';
    taskTypes: string[] | '*';
    timeWindow: TemporalWindow | null;
  };
  active: boolean;
  createdBy: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Temporal Coordination (scheduling across agents)
// ---------------------------------------------------------------------------

export interface TemporalSchedule {
  id: string;
  name: string;
  participants: ScheduleParticipant[];
  milestones: ScheduleMilestone[];
  criticalPath: string[]; // milestone IDs forming the critical path
  totalDuration: number; // ms
  slack: Record<string, number>; // milestone ID → slack time in ms
  status: 'planning' | 'active' | 'completed' | 'disrupted';
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleParticipant {
  agentId: string;
  role: string;
  availability: TemporalWindow[];
  commitments: string[]; // milestone IDs
}

export interface ScheduleMilestone {
  id: string;
  name: string;
  assignee: string; // agent ID
  dependencies: string[]; // milestone IDs that must complete first
  estimatedDuration: number; // ms
  durationConfidence: number; // 0-1
  earliestStart: string;
  latestFinish: string;
  actualStart: string | null;
  actualFinish: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
}

// ---------------------------------------------------------------------------
// Temporal Anomalies (violations of expected causal/temporal patterns)
// ---------------------------------------------------------------------------

export type TemporalAnomalyType =
  | 'causality_violation' // effect observed before cause
  | 'missing_effect' // cause observed but expected effect absent
  | 'unexpected_effect' // effect without known cause
  | 'timing_drift' // systematic shift in expected delays
  | 'pattern_break' // periodic pattern interrupted
  | 'deadline_risk' // projection shows likely deadline miss
  | 'causal_loop' // circular causation detected
  | 'phantom_cause'; // inferred cause not supported by evidence

export interface TemporalAnomaly {
  id: string;
  type: TemporalAnomalyType;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  affectedNodes: string[];
  affectedEdges: string[];
  detectedAt: string;
  evidence: CausalEvidence[];
  suggestedAction: string;
  autoResolvable: boolean;
}

// ---------------------------------------------------------------------------
// Engine configuration
// ---------------------------------------------------------------------------

export interface TemporalEngineConfig {
  maxGraphNodes: number;
  maxGraphEdges: number;
  projectionHorizonMs: number;
  anomalyDetectionIntervalMs: number;
  causalConfidenceThreshold: number; // min confidence to include edge
  pruneStaleEventsAfterMs: number;
  enableCounterfactuals: boolean;
  enableProjections: boolean;
  projectionMethods: ProjectionMethod[];
  defaultPrecision: TemporalPrecision;
}

export const DEFAULT_TEMPORAL_CONFIG: TemporalEngineConfig = {
  maxGraphNodes: 10000,
  maxGraphEdges: 50000,
  projectionHorizonMs: 24 * 60 * 60 * 1000, // 24 hours
  anomalyDetectionIntervalMs: 30_000,
  causalConfidenceThreshold: 0.3,
  pruneStaleEventsAfterMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  enableCounterfactuals: true,
  enableProjections: true,
  projectionMethods: ['causal_propagation', 'pattern_extrapolation', 'bayesian_update'],
  defaultPrecision: 'second',
};
