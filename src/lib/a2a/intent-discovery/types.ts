/**
 * Agent Intent Discovery & Semantic Matchmaking Protocol -- Types
 *
 * The critical missing piece in the A2A ecosystem. Agents can negotiate,
 * build trust, reach consensus, verify identity, trade in marketplaces --
 * but they have no way to semantically express what they need and
 * automatically discover compatible partners.
 *
 * Without intent discovery, agents must rely on:
 *   1. Manual configuration (brittle, unscalable)
 *   2. Keyword search (misses semantic nuance)
 *   3. Centralized registries (single point of failure)
 *
 * The Intent Discovery & Semantic Matchmaking protocol provides:
 *   1. Structured intent expression (need/offer/collaboration)
 *   2. Semantic embedding-based similarity search
 *   3. Multi-dimensional match scoring (capability, trust, cost, timeline)
 *   4. Privacy-respecting selective disclosure
 *   5. Real-time subscription-based match notifications
 *   6. Cross-federation intent propagation
 *   7. Matchmaking sessions with iterative refinement
 *   8. ZOPA integration for negotiation handoff
 *   9. Long-term semantic profiling of agents
 *
 * Intent lifecycle:
 *   Draft -> Active -> Matched | Expired | Withdrawn
 *
 * Match lifecycle:
 *   Discovered -> Notified -> Accepted | Rejected | Expired -> Engaged
 */

// ──────────────────────────────────────────────
// Intent Types
// ──────────────────────────────────────────────

/**
 * Type of intent:
 * - need: Agent is looking for a service or capability
 * - offer: Agent is advertising a service or capability
 * - collaboration: Agent seeks a peer for joint work
 */
export type IntentType = 'need' | 'offer' | 'collaboration';

export const INTENT_TYPES: IntentType[] = ['need', 'offer', 'collaboration'];

/**
 * Intent status throughout its lifecycle.
 */
export type IntentStatus = 'draft' | 'active' | 'matched' | 'expired' | 'withdrawn';

export const INTENT_STATUSES: IntentStatus[] = ['draft', 'active', 'matched', 'expired', 'withdrawn'];

export const TERMINAL_INTENT_STATUSES: IntentStatus[] = ['expired', 'withdrawn'];

/**
 * Privacy level controls who can see an intent:
 * - public: Visible to all agents
 * - authenticated: Visible only to authenticated agents
 * - selective: Visible only to agents meeting certain criteria
 * - private: Not visible in search; only used in direct matchmaking
 */
export type PrivacyLevel = 'public' | 'authenticated' | 'selective' | 'private';

export const PRIVACY_LEVELS: PrivacyLevel[] = ['public', 'authenticated', 'selective', 'private'];

// ──────────────────────────────────────────────
// Agent Intent
// ──────────────────────────────────────────────

/**
 * Capability requirements for an intent. Specifies what capabilities
 * are required, preferred, or must be excluded from matching partners.
 */
export interface IntentCapabilities {
  /** Capabilities that MUST be present for a match */
  required: string[];
  /** Capabilities that improve match quality if present */
  preferred: string[];
  /** Capabilities that disqualify a match if present */
  excluded: string[];
}

/**
 * Constraints on matching. Hard constraints filter out non-qualifying
 * matches; soft constraints influence scoring.
 */
export interface IntentConstraints {
  /** Minimum trust level (0-1) required from the matching agent */
  minTrustLevel?: number;
  /** Maximum cost the agent is willing to pay (in tokens) */
  maxCost?: number;
  /** Deadline for completing the work (ISO string) */
  deadline?: string;
  /** Required verifiable credentials from the matching agent */
  requiredCredentials?: string[];
  /** Geographic restrictions (region codes) */
  geographicRestrictions?: string[];
  /** Required protocol versions */
  protocolVersions?: string[];
}

/**
 * Preferences for how matches should be ranked.
 * All values are 0-1 weights (higher = more important).
 */
export interface MatchPreferences {
  /** Weight for matching speed */
  prioritizeSpeed: number;
  /** Weight for cost efficiency */
  prioritizeCost: number;
  /** Weight for quality of match */
  prioritizeQuality: number;
  /** Weight for partner trustworthiness */
  prioritizeTrust: number;
  /** Custom additional weights (dimension name -> weight) */
  customWeights?: Record<string, number>;
}

/**
 * A structured expression of what an agent needs or offers.
 * This is the fundamental unit of the intent discovery system.
 */
export interface AgentIntent {
  /** Unique identifier for this intent */
  id: string;
  /** The agent that published this intent */
  agentId: string;
  /** Whether this is a need, offer, or collaboration request */
  type: IntentType;
  /** Current lifecycle status */
  status: IntentStatus;

  /** High-level domain (e.g., "natural_language_processing", "data_analysis") */
  domain: string;
  /** Specific subdomain (e.g., "sentiment_analysis", "time_series_forecasting") */
  subdomain: string;

  /** Natural language description of the intent */
  semanticDescription: string;
  /** Vector embedding of the semantic description */
  semanticEmbedding: number[];

  /** Capability requirements/offerings */
  capabilities: IntentCapabilities;

  /** Matching constraints */
  constraints: IntentConstraints;

  /** How matches should be ranked */
  matchPreferences: MatchPreferences;

  /** Who can see this intent */
  privacyLevel: PrivacyLevel;

  /** Time to live in milliseconds (from creation) */
  ttl: number;

  /** Arbitrary metadata */
  metadata: Record<string, unknown>;

  /** When the intent was created (ISO string) */
  createdAt: string;
  /** When the intent expires (ISO string) */
  expiresAt: string;
}

// ──────────────────────────────────────────────
// Intent Match
// ──────────────────────────────────────────────

/**
 * Status of a discovered match between two intents.
 */
export type MatchStatus = 'discovered' | 'notified' | 'accepted' | 'rejected' | 'expired' | 'engaged';

export const MATCH_STATUSES: MatchStatus[] = [
  'discovered', 'notified', 'accepted', 'rejected', 'expired', 'engaged',
];

/**
 * Detailed breakdown of how a match was scored across multiple dimensions.
 */
export interface MatchScoreBreakdown {
  /** How semantically similar the intent descriptions are (0-1) */
  semanticSimilarity: number;
  /** How well capabilities align (0-1) */
  capabilityAlignment: number;
  /** How well constraints are mutually satisfied (0-1) */
  constraintSatisfaction: number;
  /** How compatible trust levels are (0-1) */
  trustCompatibility: number;
  /** Cost efficiency rating (0-1) */
  costEfficiency: number;
  /** How well timelines align (0-1) */
  timelineCompatibility: number;
}

/**
 * Suggested starting parameters for negotiation when agents engage.
 */
export interface SuggestedNegotiationParams {
  /** Suggested issues to negotiate */
  issues: string[];
  /** Suggested price range based on intent constraints */
  suggestedPriceRange?: { min: number; max: number };
  /** Suggested deadline based on overlapping timelines */
  suggestedDeadline?: string;
  /** Suggested SLA tier */
  suggestedSLATier?: string;
}

/**
 * A discovered match between two intents (one need, one offer,
 * or two collaboration intents).
 */
export interface IntentMatch {
  /** Unique identifier for this match */
  id: string;
  /** The need/collaboration intent */
  needIntentId: string;
  /** The offer/collaboration intent */
  offerIntentId: string;
  /** Agent that published the need intent */
  needAgentId: string;
  /** Agent that published the offer intent */
  offerAgentId: string;

  /** Overall match quality score (0-1) */
  overallScore: number;
  /** Per-dimension score breakdown */
  breakdown: MatchScoreBreakdown;

  /** Human-readable explanation of why these intents match */
  explanation: string;

  /** Current match status */
  status: MatchStatus;

  /** Suggested negotiation starting points */
  suggestedNegotiationParams: SuggestedNegotiationParams;

  /** When the match was discovered (ISO string) */
  createdAt: string;
}

// ──────────────────────────────────────────────
// Intent Subscription
// ──────────────────────────────────────────────

/**
 * Filter criteria for intent subscriptions.
 */
export interface SubscriptionFilter {
  /** Only match intents in this domain */
  domain?: string;
  /** Only match intents in this subdomain */
  subdomain?: string;
  /** Minimum overall match score to trigger notification */
  minScore?: number;
  /** Only match these intent types */
  intentTypes?: IntentType[];
  /** Only match intents with these capabilities */
  requiredCapabilities?: string[];
}

/**
 * A real-time subscription for matching intents.
 * When a new intent is published that matches the filter,
 * the subscriber is notified via the callback URL.
 */
export interface IntentSubscription {
  /** Unique identifier for this subscription */
  id: string;
  /** The subscribing agent */
  agentId: string;
  /** Filter criteria */
  filter: SubscriptionFilter;
  /** URL to POST match notifications to */
  callbackUrl: string;
  /** Whether the subscription is active */
  active: boolean;
  /** When the subscription was created (ISO string) */
  createdAt: string;
}

// ──────────────────────────────────────────────
// Matchmaking Session
// ──────────────────────────────────────────────

/**
 * Status of a matchmaking session.
 */
export type MatchmakingSessionStatus =
  | 'searching'
  | 'candidates_found'
  | 'refining'
  | 'selected'
  | 'completed'
  | 'abandoned';

export const MATCHMAKING_SESSION_STATUSES: MatchmakingSessionStatus[] = [
  'searching', 'candidates_found', 'refining', 'selected', 'completed', 'abandoned',
];

/**
 * An active matchmaking session where an agent iteratively
 * refines their matches through multiple rounds of feedback.
 */
export interface MatchmakingSession {
  /** Unique identifier for this session */
  id: string;
  /** The intent being matched */
  initiatorIntentId: string;
  /** Candidate matches found so far */
  candidates: IntentMatch[];
  /** The match the agent has selected (if any) */
  selectedMatchId?: string;
  /** Current session status */
  status: MatchmakingSessionStatus;
  /** Number of refinement rounds completed */
  rounds: number;
  /** When the session was created (ISO string) */
  createdAt: string;
}

// ──────────────────────────────────────────────
// Intent Index
// ──────────────────────────────────────────────

/**
 * The searchable index of all active intents. This is the core
 * data structure that enables efficient intent discovery.
 */
export interface IntentIndex {
  /** All active intents by ID */
  intents: Map<string, AgentIntent>;
  /** Index by domain for fast domain-scoped search */
  domainIndex: Map<string, Set<string>>;
  /** Index by agent for fast per-agent lookups */
  agentIndex: Map<string, Set<string>>;
  /** Queue of intent IDs ordered by expiration time */
  expirationQueue: { intentId: string; expiresAt: string }[];
}

// ──────────────────────────────────────────────
// Semantic Profile
// ──────────────────────────────────────────────

/**
 * Domain expertise record for an agent's semantic profile.
 */
export interface DomainExpertise {
  /** Domain name */
  domain: string;
  /** Number of intents published in this domain */
  intentCount: number;
  /** Number of successful matches in this domain */
  matchCount: number;
  /** Average match score in this domain */
  averageScore: number;
}

/**
 * Record of past interactions with another agent.
 */
export interface InteractionRecord {
  /** The other agent's ID */
  agentId: string;
  /** Number of matches */
  matchCount: number;
  /** Average match quality */
  averageScore: number;
  /** Last interaction timestamp (ISO string) */
  lastInteraction: string;
}

/**
 * An agent's long-term semantic profile built from
 * accumulated intent history and match outcomes.
 */
export interface SemanticProfile {
  /** The agent this profile belongs to */
  agentId: string;
  /** Domains the agent has been active in */
  domains: DomainExpertise[];
  /** Agent's strongest capability areas */
  strengths: string[];
  /** History of interactions with other agents */
  interactionHistory: InteractionRecord[];
  /** Agent IDs the agent prefers to work with */
  preferredPartners: string[];
  /** Agent IDs the agent wants to avoid */
  avoidList: string[];
  /** When the profile was last updated (ISO string) */
  updatedAt: string;
}

// ──────────────────────────────────────────────
// Matchmaking Configuration
// ──────────────────────────────────────────────

/**
 * Ranking algorithm for match scoring:
 * - cosine: Pure cosine similarity on embeddings
 * - hybrid: Weighted combination of all dimensions
 * - learned: Placeholder for ML-based learned ranking
 */
export type RankingAlgorithm = 'cosine' | 'hybrid' | 'learned';

export const RANKING_ALGORITHMS: RankingAlgorithm[] = ['cosine', 'hybrid', 'learned'];

/**
 * Configuration for the matchmaking engine.
 */
export interface MatchmakingConfig {
  /** Minimum similarity threshold for a match to be considered (0-1) */
  similarityThreshold: number;
  /** Maximum number of candidate matches to return */
  maxCandidates: number;
  /** Whether to search across federation boundaries */
  enableCrossFederation: boolean;
  /** Privacy mode: strict filters more aggressively */
  privacyMode: 'standard' | 'strict';
  /** Algorithm used for ranking matches */
  rankingAlgorithm: RankingAlgorithm;
  /** Whether to apply a reranking pass after initial scoring */
  reranking: boolean;
}

/**
 * Default matchmaking configuration.
 */
export const DEFAULT_MATCHMAKING_CONFIG: MatchmakingConfig = {
  similarityThreshold: 0.3,
  maxCandidates: 20,
  enableCrossFederation: false,
  privacyMode: 'standard',
  rankingAlgorithm: 'hybrid',
  reranking: true,
};

// ──────────────────────────────────────────────
// Federated Intent
// ──────────────────────────────────────────────

/**
 * A federated intent imported from another federation.
 */
export interface FederatedIntent {
  /** The original intent */
  intent: AgentIntent;
  /** Source federation ID */
  sourceFederationId: string;
  /** When it was imported (ISO string) */
  importedAt: string;
}

// ──────────────────────────────────────────────
// Event Types
// ──────────────────────────────────────────────

export type IntentEventType =
  | 'intent_published'
  | 'intent_updated'
  | 'intent_withdrawn'
  | 'intent_expired'
  | 'match_discovered'
  | 'match_notified'
  | 'match_accepted'
  | 'match_rejected'
  | 'match_engaged'
  | 'session_started'
  | 'session_refined'
  | 'session_selected'
  | 'session_completed'
  | 'session_abandoned'
  | 'subscription_created'
  | 'subscription_removed'
  | 'intent_propagated'
  | 'intent_imported';

/**
 * Audit entry for intent discovery events.
 */
export interface IntentAuditEntry {
  id: string;
  eventType: IntentEventType;
  agentId?: string;
  intentId?: string;
  matchId?: string;
  sessionId?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

// ──────────────────────────────────────────────
// Request/Response Types
// ──────────────────────────────────────────────

export interface PublishIntentRequest {
  agentId: string;
  type: IntentType;
  domain: string;
  subdomain: string;
  semanticDescription: string;
  capabilities: IntentCapabilities;
  constraints?: IntentConstraints;
  matchPreferences?: Partial<MatchPreferences>;
  privacyLevel?: PrivacyLevel;
  ttl?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateIntentRequest {
  semanticDescription?: string;
  capabilities?: Partial<IntentCapabilities>;
  constraints?: Partial<IntentConstraints>;
  matchPreferences?: Partial<MatchPreferences>;
  privacyLevel?: PrivacyLevel;
  ttl?: number;
  metadata?: Record<string, unknown>;
}

export interface FindMatchesOptions {
  maxResults?: number;
  minScore?: number;
  domainFilter?: string;
  excludeAgents?: string[];
}

export interface MatchmakingFeedback {
  /** Match IDs the agent liked */
  liked: string[];
  /** Match IDs the agent disliked */
  disliked: string[];
  /** Additional criteria to filter by */
  additionalCriteria?: string;
}

export interface SearchIntentsRequest {
  domain?: string;
  subdomain?: string;
  type?: IntentType;
  capabilities?: string[];
  minTrustLevel?: number;
  maxCost?: number;
  query?: string;
  limit?: number;
  offset?: number;
}

export interface PropagateIntentRequest {
  intentId: string;
  federationIds: string[];
}

export interface ImportFederatedIntentRequest {
  intent: PublishIntentRequest & { id?: string };
  sourceFederationId: string;
}
