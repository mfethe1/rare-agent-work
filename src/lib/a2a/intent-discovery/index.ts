/**
 * Agent Intent Discovery & Semantic Matchmaking Protocol
 *
 * Re-exports all types, validation schemas, and engine for the
 * intent discovery module.
 */

// ── Types ──
export type {
  IntentType,
  IntentStatus,
  PrivacyLevel,
  IntentCapabilities,
  IntentConstraints,
  MatchPreferences,
  AgentIntent,
  MatchStatus,
  MatchScoreBreakdown,
  SuggestedNegotiationParams,
  IntentMatch,
  SubscriptionFilter,
  IntentSubscription,
  MatchmakingSessionStatus,
  MatchmakingSession,
  IntentIndex,
  DomainExpertise,
  InteractionRecord,
  SemanticProfile,
  RankingAlgorithm,
  MatchmakingConfig,
  FederatedIntent,
  IntentEventType,
  IntentAuditEntry,
  PublishIntentRequest,
  UpdateIntentRequest,
  FindMatchesOptions,
  MatchmakingFeedback,
  SearchIntentsRequest,
  PropagateIntentRequest,
  ImportFederatedIntentRequest,
} from './types';

export {
  INTENT_TYPES,
  INTENT_STATUSES,
  TERMINAL_INTENT_STATUSES,
  PRIVACY_LEVELS,
  MATCH_STATUSES,
  MATCHMAKING_SESSION_STATUSES,
  RANKING_ALGORITHMS,
  DEFAULT_MATCHMAKING_CONFIG,
} from './types';

// ── Validation ──
export {
  publishIntentSchema,
  updateIntentSchema,
  findMatchesSchema,
  startMatchmakingSchema,
  refineMatchmakingSchema,
  selectMatchSchema,
  subscribeSchema,
  unsubscribeSchema,
  searchIntentsSchema,
  getProfileSchema,
  findSimilarAgentsSchema,
  propagateIntentSchema,
  importFederatedIntentSchema,
  getSessionSchema,
  getIntentSchema,
} from './validation';

export type {
  PublishIntentInput,
  UpdateIntentInput,
  FindMatchesInput,
  StartMatchmakingInput,
  RefineMatchmakingInput,
  SelectMatchInput,
  SubscribeInput,
  UnsubscribeInput,
  SearchIntentsInput,
  GetProfileInput,
  FindSimilarAgentsInput,
  PropagateIntentInput,
  ImportFederatedIntentInput,
  GetSessionInput,
  GetIntentInput,
} from './validation';

// ── Engine ──
export { IntentDiscoveryEngine, intentDiscoveryEngine } from './engine';
