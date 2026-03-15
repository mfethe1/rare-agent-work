/**
 * A2A Agent Metacognition & Recursive Self-Improvement
 *
 * Enables agents to reason about their own reasoning, detect systematic
 * failures, evolve strategies, and recursively self-improve — all bounded
 * by formal alignment guardrails.
 */

// Types
export type {
  // Cognitive profile
  CognitiveProfile,
  DomainCompetency,
  CognitiveBias,
  BiasSeverity,

  // Failure patterns
  FailurePattern,
  FailureCategory,

  // Introspection
  IntrospectionReport,
  DecisionPoint,
  DecisionQuality,
  TaskOutcome,

  // Blind spots
  BlindSpot,
  BlindSpotType,
  BlindSpotEvidence,

  // Strategy evolution
  Strategy,
  StrategyStatus,
  StrategyTestResult,

  // Improvement cycles
  ImprovementCycle,
  CyclePhase,
  CycleTrigger,

  // Alignment
  AlignmentInvariant,
  AlignmentCheckResult,
  AlignmentViolation,
  InvariantType,

  // Propagation
  ImprovementPropagation,
  PropagationStatus,
  ProvenanceLink,

  // API types
  IntrospectRequest,
  IntrospectResponse,
  GetCognitiveProfileRequest,
  GetCognitiveProfileResponse,
  GenerateStrategiesRequest,
  GenerateStrategiesResponse,
  StartImprovementCycleRequest,
  StartImprovementCycleResponse,
  GetBlindSpotsRequest,
  GetBlindSpotsResponse,
  PropagateImprovementRequest,
  PropagateImprovementResponse,
} from './types';

// Validation schemas
export {
  introspectSchema,
  generateStrategiesSchema,
  recordTestResultSchema,
  startImprovementCycleSchema,
  advanceCycleSchema,
  getCognitiveProfileSchema,
  getBlindSpotsSchema,
  adoptStrategySchema,
  propagateImprovementSchema,
  recordPropagationResponseSchema,
} from './validation';

export type {
  IntrospectInput,
  GenerateStrategiesInput,
  RecordTestResultInput,
  StartImprovementCycleInput,
  AdvanceCycleInput,
  GetCognitiveProfileInput,
  GetBlindSpotsInput,
  AdoptStrategyInput,
  PropagateImprovementInput,
  RecordPropagationResponseInput,
} from './validation';

// Engine functions
export {
  // Cognitive profile
  getOrCreateProfile,
  getCognitiveProfile,

  // Introspection
  introspect,
  getIntrospectionReport,
  getAgentReports,

  // Blind spots
  getBlindSpots,

  // Strategy evolution
  generateStrategies,
  getStrategy,
  getAgentStrategies,
  recordStrategyTestResult,
  adoptStrategy,

  // Improvement cycles
  startImprovementCycle,
  advanceImprovementCycle,
  getImprovementCycle,
  getAgentCycles,

  // Alignment
  checkAlignment,

  // Propagation
  propagateImprovement,
  recordPropagationResponse,
  getPropagation,
  getAgentPropagations,

  // Summary
  getMetacognitionSummary,
} from './engine';

export type { MetacognitionSummary } from './engine';
