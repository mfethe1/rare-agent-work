/**
 * Agent Negotiation & Strategic Bargaining Protocol — Types
 *
 * In 2028, the fatal flaw of agent ecosystems is the absence of
 * structured negotiation. Consensus is voting on pre-formed proposals.
 * But who creates the proposals? How do agents discover mutually
 * beneficial terms? How do they trade across multiple issues
 * simultaneously?
 *
 * Without negotiation, agent economies collapse into two failure modes:
 *   1. Take-it-or-leave-it (marketplace) — zero creative value discovery
 *   2. Majority-rules (consensus) — minority preferences discarded
 *
 * Real agent economies need Nash bargaining, BATNA-aware concession,
 * multi-issue bundling, and Pareto-optimal deal discovery.
 *
 * The negotiation protocol provides:
 *   1. Multi-round offer/counteroffer with configurable strategies
 *   2. Multi-issue negotiations with issue-level preferences
 *   3. BATNA (Best Alternative To Negotiated Agreement) modeling
 *   4. ZOPA (Zone of Possible Agreement) detection
 *   5. 6 concession strategies (boulware, conceder, linear, tit-for-tat,
 *      random, hybrid)
 *   6. N-party negotiation with coalition formation
 *   7. Deadline pressure with time-dependent utility
 *   8. Mediation protocol for deadlock resolution
 *   9. Binding agreement generation with enforcement hooks
 *
 * Negotiation lifecycle:
 *   Initiated → Proposing → Bargaining → Converging → Agreed | Failed | Mediated
 *
 * Council critique addressed:
 *   Musk: "Agents without negotiation are just sophisticated cron jobs."
 *   Altman: "The economy of agents is negotiation. Everything else is plumbing."
 *   Hinton: "Game theory without bargaining is half a theory."
 *   Hassabis: "AlphaGo taught us: search + evaluation. Negotiation is search
 *              over the space of possible agreements."
 *   Amodei: "Negotiation with safety bounds prevents race-to-the-bottom dynamics."
 *   Nadella: "Enterprise agents must negotiate SLAs, not just accept them."
 *   Berman: "The agentic future is agents making deals, not following scripts."
 */

// ──────────────────────────────────────────────
// Negotiation Strategies
// ──────────────────────────────────────────────

/**
 * Concession strategies determine how agents move from their ideal
 * position toward agreement over time:
 *
 * - boulware: Concede slowly, then rapidly near deadline. Tough negotiator.
 * - conceder: Concede rapidly early, stabilize. Cooperative negotiator.
 * - linear: Constant rate of concession. Predictable.
 * - tit_for_tat: Mirror opponent's last concession magnitude.
 * - random: Random concessions within bounds. Unpredictable.
 * - hybrid: Weighted blend of multiple strategies.
 */
export type ConcessionStrategy =
  | 'boulware'
  | 'conceder'
  | 'linear'
  | 'tit_for_tat'
  | 'random'
  | 'hybrid';

export const CONCESSION_STRATEGIES: ConcessionStrategy[] = [
  'boulware',
  'conceder',
  'linear',
  'tit_for_tat',
  'random',
  'hybrid',
];

// ──────────────────────────────────────────────
// Negotiation Status
// ──────────────────────────────────────────────

export type NegotiationStatus =
  | 'initiated'
  | 'proposing'
  | 'bargaining'
  | 'converging'
  | 'agreed'
  | 'failed'
  | 'mediated'
  | 'expired'
  | 'cancelled';

export const TERMINAL_STATUSES: NegotiationStatus[] = [
  'agreed',
  'failed',
  'expired',
  'cancelled',
];

// ──────────────────────────────────────────────
// Issue Types & Preferences
// ──────────────────────────────────────────────

/**
 * Issue types for multi-issue negotiation:
 * - numeric: Continuous value (price, duration, quantity)
 * - categorical: Discrete options (provider, region, tier)
 * - boolean: Binary (include/exclude feature)
 * - package: Bundle of sub-issues negotiated atomically
 */
export type IssueType = 'numeric' | 'categorical' | 'boolean' | 'package';

/**
 * A single negotiable issue within a negotiation.
 * Each issue has a type, acceptable range, and relative importance weight.
 */
export interface NegotiationIssue {
  id: string;
  name: string;
  type: IssueType;
  description?: string;

  /** For numeric issues: acceptable range */
  min_value?: number;
  max_value?: number;

  /** For categorical issues: acceptable options */
  options?: string[];

  /** For package issues: sub-issue IDs */
  sub_issues?: string[];

  /** Whether this issue is mandatory (must be resolved) */
  mandatory: boolean;
}

/**
 * An agent's private preference for a specific issue.
 * This is NEVER shared with counterparties — it drives strategy.
 */
export interface IssuePreference {
  issue_id: string;

  /** Relative importance weight (0-1, sum across issues = 1) */
  weight: number;

  /** Ideal value (what the agent truly wants) */
  ideal_value: number | string | boolean;

  /** Reservation value (walk-away point) */
  reservation_value: number | string | boolean;

  /** Utility function shape for numeric issues */
  utility_curve?: 'linear' | 'concave' | 'convex' | 'step';
}

// ──────────────────────────────────────────────
// BATNA (Best Alternative To Negotiated Agreement)
// ──────────────────────────────────────────────

/**
 * BATNA represents what an agent gets if negotiation fails.
 * It sets the floor — no rational agent accepts less than their BATNA.
 */
export interface BATNA {
  agent_id: string;

  /** Overall utility of the best alternative (0-1) */
  alternative_utility: number;

  /** Description of the alternative */
  description: string;

  /** Confidence in the alternative being available (0-1) */
  confidence: number;

  /** Time sensitivity — does the alternative degrade over time? */
  time_decay_rate?: number;

  /** Evaluated at */
  evaluated_at: string;
}

// ──────────────────────────────────────────────
// Offers & Counteroffers
// ──────────────────────────────────────────────

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired' | 'withdrawn';

/**
 * A single value proposed for a specific issue.
 */
export interface IssueValue {
  issue_id: string;
  value: number | string | boolean;
}

/**
 * An offer in a negotiation round. Contains proposed values for
 * all (or some) issues, plus metadata about the offer.
 */
export interface NegotiationOffer {
  id: string;
  negotiation_id: string;
  round: number;
  from_agent_id: string;

  /** Proposed values for each issue */
  proposed_values: IssueValue[];

  /** Optional message/rationale */
  message?: string;

  /** Offer status */
  status: OfferStatus;

  /** Concession magnitude from previous offer (0-1) */
  concession_magnitude?: number;

  /** Expires at (ISO string) */
  expires_at?: string;

  /** Created at (ISO string) */
  created_at: string;
}

// ──────────────────────────────────────────────
// ZOPA (Zone of Possible Agreement)
// ──────────────────────────────────────────────

/**
 * ZOPA analysis for a specific issue between parties.
 * If ZOPA exists, agreement is theoretically possible on this issue.
 */
export interface ZOPAAnalysis {
  issue_id: string;
  exists: boolean;

  /** For numeric issues: the overlapping range */
  overlap_min?: number;
  overlap_max?: number;

  /** For categorical: the set of mutually acceptable options */
  common_options?: string[];

  /** ZOPA size (0-1 normalized) — larger = easier to agree */
  zopa_size: number;

  /** Suggested focal point (Schelling point) */
  focal_point?: number | string | boolean;
}

// ──────────────────────────────────────────────
// Negotiation Parties
// ──────────────────────────────────────────────

export type PartyRole = 'initiator' | 'responder' | 'mediator' | 'observer';

export interface NegotiationParty {
  agent_id: string;
  role: PartyRole;

  /** Agent's chosen strategy (private) */
  strategy: ConcessionStrategy;

  /** Strategy parameters */
  strategy_params?: {
    /** Boulware/conceder exponent (β). β < 1 = boulware, β > 1 = conceder */
    beta?: number;
    /** For hybrid: weights for sub-strategies */
    hybrid_weights?: Record<ConcessionStrategy, number>;
    /** Minimum concession per round */
    min_concession?: number;
    /** Maximum concession per round */
    max_concession?: number;
  };

  /** Agent's private preferences (NEVER exposed) */
  preferences: IssuePreference[];

  /** Agent's BATNA */
  batna?: BATNA;

  /** Has this party accepted the current offer? */
  has_accepted: boolean;

  /** Number of offers made */
  offers_made: number;

  /** Joined at */
  joined_at: string;
}

// ──────────────────────────────────────────────
// Negotiation Session
// ──────────────────────────────────────────────

export type NegotiationDomain =
  | 'resource_pricing'
  | 'sla_terms'
  | 'task_allocation'
  | 'capability_trade'
  | 'coalition_formation'
  | 'data_exchange'
  | 'service_contract'
  | 'dispute_settlement'
  | 'custom';

export const NEGOTIATION_DOMAINS: NegotiationDomain[] = [
  'resource_pricing',
  'sla_terms',
  'task_allocation',
  'capability_trade',
  'coalition_formation',
  'data_exchange',
  'service_contract',
  'dispute_settlement',
  'custom',
];

/**
 * Configuration for deadline pressure effects.
 * As deadline approaches, agents may become more willing to concede.
 */
export interface DeadlinePressure {
  /** Hard deadline (ISO string) */
  deadline: string;

  /** Pressure curve: how urgency scales with time */
  pressure_curve: 'linear' | 'exponential' | 'step';

  /** At what fraction of time remaining does pressure kick in (0-1) */
  pressure_threshold: number;

  /** Maximum pressure multiplier on concession rate */
  max_pressure_multiplier: number;
}

/**
 * Mediation configuration for deadlock resolution.
 */
export interface MediationConfig {
  /** Auto-trigger mediation after N rounds of no progress */
  deadlock_threshold: number;

  /** Mediator agent ID (if pre-assigned) */
  mediator_agent_id?: string;

  /** Mediation strategy */
  mediation_strategy: 'split_difference' | 'single_text' | 'interest_based' | 'binding_arbitration';

  /** Can mediator impose a solution? */
  binding: boolean;
}

/**
 * A full negotiation session between N parties.
 */
export interface NegotiationSession {
  id: string;
  domain: NegotiationDomain;
  title: string;
  description?: string;

  /** Negotiation status */
  status: NegotiationStatus;

  /** Issues being negotiated */
  issues: NegotiationIssue[];

  /** Participating parties */
  parties: NegotiationParty[];

  /** All offers made (ordered by round) */
  offers: NegotiationOffer[];

  /** Current round number */
  current_round: number;

  /** Maximum allowed rounds before auto-fail or mediation */
  max_rounds: number;

  /** Minimum rounds before agreement can be reached */
  min_rounds: number;

  /** Deadline pressure config */
  deadline?: DeadlinePressure;

  /** Mediation config */
  mediation?: MediationConfig;

  /** Whether the negotiation has a ZOPA */
  zopa_exists?: boolean;

  /** ZOPA analysis per issue */
  zopa_analysis?: ZOPAAnalysis[];

  /** Created at */
  created_at: string;

  /** Updated at */
  updated_at: string;

  /** Completed at */
  completed_at?: string;
}

// ──────────────────────────────────────────────
// Agreement
// ──────────────────────────────────────────────

export type AgreementStatus = 'draft' | 'signed' | 'enforcing' | 'completed' | 'breached' | 'voided';

/**
 * A binding agreement resulting from successful negotiation.
 */
export interface NegotiationAgreement {
  id: string;
  negotiation_id: string;

  /** Agreed values for each issue */
  agreed_values: IssueValue[];

  /** Parties who signed */
  signatories: {
    agent_id: string;
    signed_at: string;
    signature_hash: string;
  }[];

  /** Agreement status */
  status: AgreementStatus;

  /** Enforcement actions to execute on agreement */
  enforcement_actions?: EnforcementHook[];

  /** Breach penalty configuration */
  breach_penalties?: BreachPenalty[];

  /** Effective from (ISO string) */
  effective_from: string;

  /** Expires at (ISO string) */
  expires_at?: string;

  /** Created at */
  created_at: string;
}

export interface EnforcementHook {
  type: 'api_call' | 'task_submit' | 'escrow_release' | 'governance_update' | 'custom';
  target: string;
  payload: Record<string, unknown>;
  execute_on: 'agreement_signed' | 'agreement_completed' | 'agreement_breached';
}

export interface BreachPenalty {
  condition: string;
  penalty_type: 'reputation_deduction' | 'token_penalty' | 'capability_restriction' | 'trust_demotion';
  severity: number;
  description: string;
}

// ──────────────────────────────────────────────
// Negotiation Analytics
// ──────────────────────────────────────────────

/**
 * Pareto efficiency analysis of the current state.
 */
export interface ParetoAnalysis {
  negotiation_id: string;

  /** Is the current offer Pareto-optimal? */
  is_pareto_optimal: boolean;

  /** Potential Pareto improvements (issue_id → direction) */
  improvement_opportunities: {
    issue_id: string;
    direction: 'increase' | 'decrease' | 'change_to';
    suggested_value?: number | string | boolean;
    utility_gain_initiator: number;
    utility_gain_responder: number;
  }[];

  /** Overall negotiation efficiency (0-1) */
  efficiency_score: number;

  /** Nash bargaining solution values */
  nash_solution?: IssueValue[];

  /** Analyzed at */
  analyzed_at: string;
}

/**
 * Round-by-round negotiation history for analytics.
 */
export interface NegotiationRoundSummary {
  round: number;
  offers_in_round: NegotiationOffer[];
  concession_magnitudes: Record<string, number>;
  distance_to_agreement: number;
  convergence_rate: number;
  elapsed_time_ms: number;
}

// ──────────────────────────────────────────────
// Audit Trail
// ──────────────────────────────────────────────

export type NegotiationEventType =
  | 'session_created'
  | 'party_joined'
  | 'offer_made'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'offer_countered'
  | 'offer_expired'
  | 'offer_withdrawn'
  | 'mediation_triggered'
  | 'mediator_proposal'
  | 'agreement_reached'
  | 'agreement_signed'
  | 'agreement_breached'
  | 'negotiation_failed'
  | 'negotiation_expired'
  | 'negotiation_cancelled'
  | 'zopa_computed'
  | 'pareto_analyzed'
  | 'deadline_pressure_applied';

export interface NegotiationAuditEntry {
  id: string;
  negotiation_id: string;
  event_type: NegotiationEventType;
  agent_id?: string;
  round?: number;
  details: Record<string, unknown>;
  timestamp: string;
}

// ──────────────────────────────────────────────
// Request/Response Types
// ──────────────────────────────────────────────

export interface CreateNegotiationRequest {
  domain: NegotiationDomain;
  title: string;
  description?: string;
  issues: NegotiationIssue[];
  initiator: {
    agent_id: string;
    strategy: ConcessionStrategy;
    strategy_params?: NegotiationParty['strategy_params'];
    preferences: IssuePreference[];
    batna?: Omit<BATNA, 'agent_id' | 'evaluated_at'>;
  };
  max_rounds?: number;
  min_rounds?: number;
  deadline?: DeadlinePressure;
  mediation?: MediationConfig;
}

export interface JoinNegotiationRequest {
  negotiation_id: string;
  agent_id: string;
  role?: PartyRole;
  strategy: ConcessionStrategy;
  strategy_params?: NegotiationParty['strategy_params'];
  preferences: IssuePreference[];
  batna?: Omit<BATNA, 'agent_id' | 'evaluated_at'>;
}

export interface MakeOfferRequest {
  negotiation_id: string;
  from_agent_id: string;
  proposed_values: IssueValue[];
  message?: string;
  expires_in_ms?: number;
}

export interface RespondToOfferRequest {
  negotiation_id: string;
  offer_id: string;
  agent_id: string;
  action: 'accept' | 'reject' | 'counter';
  counter_values?: IssueValue[];
  message?: string;
}

export interface ComputeZOPARequest {
  negotiation_id: string;
}

export interface ParetoAnalysisRequest {
  negotiation_id: string;
  offer_id?: string;
}

export interface TriggerMediationRequest {
  negotiation_id: string;
  mediator_agent_id?: string;
  reason: string;
}

export interface SignAgreementRequest {
  negotiation_id: string;
  agent_id: string;
}

export interface GenerateCounterOfferRequest {
  negotiation_id: string;
  agent_id: string;
  /** Override strategy for this round */
  override_strategy?: ConcessionStrategy;
}
