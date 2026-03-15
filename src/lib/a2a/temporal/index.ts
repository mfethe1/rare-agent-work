/**
 * Temporal Intelligence & Causal Reasoning Engine
 *
 * A2A subsystem providing agents with the ability to:
 * - Build and query causal models of agent interactions
 * - Predict future ecosystem states through multiple projection methods
 * - Perform counterfactual "what-if" analysis using do-calculus
 * - Coordinate schedules with critical-path awareness
 * - Maintain correct causal ordering via vector clocks
 * - Detect temporal anomalies (causality violations, timing drift, deadline risks)
 *
 * @module a2a/temporal
 */

// Types
export type {
  TemporalPrecision,
  TemporalWindow,
  TemporalCoordinate,
  CausalRelation,
  CausalNode,
  CausalEdge,
  CausalEvidence,
  CausalGraph,
  TemporalEventType,
  TemporalEvent,
  PeriodicPattern,
  Counterfactual,
  CounterfactualIntervention,
  CounterfactualOutcome,
  ProjectionMethod,
  FutureProjection,
  Prediction,
  SensitivityFactor,
  TemporalConstraintType,
  TemporalConstraint,
  TemporalPolicy,
  TemporalSchedule,
  ScheduleParticipant,
  ScheduleMilestone,
  TemporalAnomalyType,
  TemporalAnomaly,
  TemporalEngineConfig,
} from './types';
export { DEFAULT_TEMPORAL_CONFIG } from './types';

// Causal Graph
export {
  createCausalGraph,
  addNode,
  addEdge,
  removeNode,
  removeEdge,
  topologicalSort,
  findCausalPaths,
  getCausalAncestors,
  getCausalDescendants,
  isDSeparated,
  computeCausalStrength,
  detectCausalAnomalies,
  mergeCausalGraphs,
} from './causal-graph';

// Future Projections
export {
  projectByCausalPropagation,
  projectByPatternExtrapolation,
  projectByMonteCarlo,
  projectByEnsemble,
} from './projections';

// Counterfactual Reasoning
export {
  applyIntervention,
  computeCounterfactual,
  compareInterventions,
  findMinimalIntervention,
  attributeCausalResponsibility,
} from './counterfactuals';

// Temporal Scheduling
export {
  createSchedule,
  computeCriticalPath,
  evaluateConstraint,
  evaluatePolicy,
  detectScheduleRisks,
} from './scheduling';

// Vector Clocks & Causal Ordering
export type { VectorClock, CausalOrder } from './vector-clock';
export {
  createVectorClock,
  tick,
  merge,
  compare,
  happenedBefore,
  isConcurrent,
  createTemporalCoordinate,
  causalSort,
  detectClockSkew,
} from './vector-clock';
