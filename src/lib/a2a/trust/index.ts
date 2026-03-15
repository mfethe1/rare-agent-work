/**
 * Agent Progressive Trust & Dynamic Autonomy Protocol
 *
 * Closes the critical loop in the A2A ecosystem:
 *   Reputation → Trust Score → Autonomy Level → Governance → Behavior
 *
 * @module a2a/trust
 */

// Types
export type {
  TrustDomain,
  DomainTrust,
  AgentTrustProfile,
  TrustEvent,
  TrustEventType,
  TrustSignal,
  TrustEvaluationResult,
  TrustScoreWeights,
  TrustThresholds,
  TrustTrigger,
} from './types';

export {
  TRUST_DOMAINS,
  DEFAULT_THRESHOLDS,
  HIGH_STAKES_THRESHOLDS,
  HIGH_STAKES_DOMAINS,
  DEFAULT_SCORE_WEIGHTS,
  AUTONOMY_ORDER,
  scoreToAutonomyLevel,
  compareAutonomy,
} from './types';

// Engine
export {
  getOrCreateProfile,
  getProfile,
  listProfiles,
  evaluateSignal,
  evaluateBatch,
  setManualOverride,
  liftManualOverride,
  adjustThresholds,
  getEventHistory,
  getDomainAutonomy,
  hasAutonomy,
  resolveExpiredProbations,
  registerCustomDomain,
  listCustomDomains,
  resetTrustState,
} from './engine';

// Validation
export {
  trustSignalSchema,
  manualOverrideSchema,
  liftOverrideSchema,
  thresholdAdjustmentSchema,
  trustProfileQuerySchema,
  trustHistoryQuerySchema,
  batchTrustSignalSchema,
  customDomainSchema,
} from './validation';

export type {
  TrustSignalInput,
  ManualOverrideInput,
  LiftOverrideInput,
  ThresholdAdjustmentInput,
  TrustProfileQuery,
  TrustHistoryQuery,
  BatchTrustSignalInput,
  CustomDomainInput,
} from './validation';
