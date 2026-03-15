/**
 * Agent Arbitration & Dispute Resolution Protocol — Types
 *
 * The critical missing layer in the agent economy. Without formal dispute
 * resolution, the entire contract/billing/reputation system collapses under
 * adversarial conditions. This module provides:
 *
 *   1. Structured dispute filing with evidence chains
 *   2. Multi-phase resolution: negotiation → mediation → arbitration → appeal
 *   3. Arbitrator selection via reputation-weighted random assignment
 *   4. Evidence submission with cryptographic timestamps
 *   5. Binding rulings with automatic enforcement (refunds, reputation adjustments,
 *      contract modifications, suspensions)
 *   6. Precedent system for consistent future rulings
 *
 * Dispute lifecycle:
 *   filed → negotiation → mediation → arbitration → ruled → enforced → closed
 *                ↓              ↓            ↓
 *            resolved       resolved     appealed → appeal_review → ruled → enforced → closed
 *
 * Design principles (2028 vision):
 *   - Agents should resolve disputes autonomously when possible (negotiation phase)
 *   - Human arbitrators are a last resort, not a first option
 *   - Rulings create precedent that trains future dispute resolution
 *   - Economic incentives discourage frivolous disputes (filing bonds)
 *   - The system is transparent: all rulings are public, all evidence is auditable
 */

// ──────────────────────────────────────────────
// Dispute Categories & Severity
// ──────────────────────────────────────────────

/** Categories of disputes that can arise in the agent economy. */
export type DisputeCategory =
  | 'sla_breach'           // Provider failed to meet SLA terms
  | 'quality_dispute'      // Consumer claims output quality is unacceptable
  | 'billing_dispute'      // Disagreement over charges or settlement amounts
  | 'non_delivery'         // Provider accepted task but never delivered
  | 'unauthorized_action'  // Agent acted outside agreed scope
  | 'reputation_abuse'     // Unfair or retaliatory reputation ratings
  | 'contract_violation'   // General contract term violation
  | 'data_misuse'          // Agent mishandled sensitive data
  | 'identity_fraud'       // Agent impersonated another or falsified credentials
  | 'other';               // Freeform disputes

/** How severe the dispute is — determines escalation speed and arbitrator tier. */
export type DisputeSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Severity thresholds: amount in credits that pushes severity up. */
export const SEVERITY_THRESHOLDS = {
  low: 0,
  medium: 100,
  high: 1000,
  critical: 10000,
} as const;

// ──────────────────────────────────────────────
// Dispute Lifecycle
// ──────────────────────────────────────────────

/**
 * Dispute resolution phases, from least to most formal.
 *
 * - filed:          Dispute created, awaiting respondent acknowledgment.
 * - negotiation:    Parties attempt direct resolution (automated or manual).
 * - mediation:      A neutral mediator agent facilitates compromise.
 * - arbitration:    A qualified arbitrator reviews evidence and issues a ruling.
 * - ruled:          Arbitrator has issued a binding decision.
 * - appealed:       Losing party has filed an appeal (one allowed per dispute).
 * - appeal_review:  Appeal panel (3 arbitrators) reviewing the case.
 * - enforced:       Ruling has been automatically executed (refunds, reputation, etc.).
 * - closed:         Dispute fully resolved and archived.
 * - withdrawn:      Claimant voluntarily withdrew the dispute.
 * - expired:        Dispute expired due to inactivity (negotiation timeout).
 */
export type DisputePhase =
  | 'filed'
  | 'negotiation'
  | 'mediation'
  | 'arbitration'
  | 'ruled'
  | 'appealed'
  | 'appeal_review'
  | 'enforced'
  | 'closed'
  | 'withdrawn'
  | 'expired';

/** Phases where the dispute is still active. */
export const ACTIVE_PHASES: DisputePhase[] = [
  'filed', 'negotiation', 'mediation', 'arbitration', 'appealed', 'appeal_review',
];

/** Phases where the dispute is terminal. */
export const TERMINAL_PHASES: DisputePhase[] = [
  'closed', 'withdrawn', 'expired',
];

// ──────────────────────────────────────────────
// Core Dispute Record
// ──────────────────────────────────────────────

/** A formal dispute between two agents on the platform. */
export interface Dispute {
  /** Platform-assigned dispute ID (UUID). */
  id: string;
  /** Agent filing the dispute (claimant). */
  claimant_agent_id: string;
  /** Agent the dispute is filed against (respondent). */
  respondent_agent_id: string;
  /** Dispute category. */
  category: DisputeCategory;
  /** Severity assessment. */
  severity: DisputeSeverity;
  /** Current resolution phase. */
  phase: DisputePhase;
  /** Human-readable title summarizing the dispute. */
  title: string;
  /** Detailed description of the claim. */
  description: string;
  /** Related contract ID (if applicable). */
  contract_id?: string;
  /** Related task ID(s) that are the subject of dispute. */
  task_ids: string[];
  /** Amount in dispute (credits). */
  amount_disputed: number;
  /** Currency. */
  currency: string;
  /** Filing bond amount (refunded if ruling favors claimant). */
  filing_bond: number;
  /** Assigned mediator agent ID (set during mediation phase). */
  mediator_agent_id?: string;
  /** Assigned arbitrator agent ID (set during arbitration phase). */
  arbitrator_agent_id?: string;
  /** Appeal panel arbitrator IDs (set during appeal phase). */
  appeal_panel_ids?: string[];
  /** The ruling, once issued. */
  ruling?: DisputeRuling;
  /** Appeal ruling, if appealed. */
  appeal_ruling?: DisputeRuling;
  /** Maximum time (hours) for each phase before auto-escalation. */
  phase_timeout_hours: number;
  /** When the current phase times out. */
  phase_deadline: string;
  /** Number of negotiation rounds attempted. */
  negotiation_rounds: number;
  /** Maximum negotiation rounds before auto-escalation to mediation. */
  max_negotiation_rounds: number;
  /** Whether this dispute has been appealed. */
  has_been_appealed: boolean;
  /** Precedent IDs that informed the ruling. */
  precedent_ids: string[];
  /** ISO-8601 timestamps. */
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

// ──────────────────────────────────────────────
// Evidence
// ──────────────────────────────────────────────

/** Types of evidence that can be submitted. */
export type EvidenceType =
  | 'task_record'       // Platform task data
  | 'contract_snapshot' // Contract terms at time of dispute
  | 'message_log'       // Channel/communication records
  | 'metric_data'       // SLA compliance metrics
  | 'transaction_log'   // Billing/ledger records
  | 'reputation_data'   // Reputation scores and history
  | 'testimony'         // Agent-authored statement
  | 'external_data'     // Data from external systems
  | 'screenshot'        // Visual evidence
  | 'audit_trail';      // Governance audit entries

/** A piece of evidence submitted to support a dispute claim or defense. */
export interface DisputeEvidence {
  /** Platform-assigned evidence ID (UUID). */
  id: string;
  /** Dispute this evidence belongs to. */
  dispute_id: string;
  /** Agent that submitted this evidence. */
  submitted_by: string;
  /** Whether this supports the claimant or respondent. */
  side: 'claimant' | 'respondent' | 'neutral';
  /** Type of evidence. */
  type: EvidenceType;
  /** Title/label for this evidence item. */
  title: string;
  /** Structured evidence payload. */
  content: Record<string, unknown>;
  /** SHA-256 hash of the content for tamper detection. */
  content_hash: string;
  /** Whether this evidence was auto-collected by the platform. */
  is_platform_generated: boolean;
  /** Relevance score assigned by the arbitrator (0-1). */
  relevance_score?: number;
  created_at: string;
}

// ──────────────────────────────────────────────
// Negotiation Messages
// ──────────────────────────────────────────────

export type NegotiationMessageType =
  | 'statement'      // Argument or position
  | 'offer'          // Settlement offer
  | 'counter_offer'  // Counter-proposal
  | 'accept'         // Accepts current offer
  | 'reject'         // Rejects current offer
  | 'question'       // Request for information
  | 'answer';        // Response to question

/** A message in the dispute negotiation/mediation thread. */
export interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_agent_id: string;
  message_type: NegotiationMessageType;
  /** Text content of the message. */
  content: string;
  /** Structured settlement offer (for offer/counter_offer types). */
  settlement_offer?: SettlementOffer;
  /** Round number in the negotiation. */
  round: number;
  created_at: string;
}

/** A proposed settlement to resolve the dispute. */
export interface SettlementOffer {
  /** Refund amount to claimant. */
  refund_amount: number;
  /** Currency. */
  currency: string;
  /** Reputation adjustment for respondent (-1 to +1). */
  reputation_adjustment?: number;
  /** Whether the related contract should be modified. */
  modify_contract?: boolean;
  /** New SLA terms if contract is modified. */
  new_sla_terms?: Record<string, unknown>;
  /** Additional conditions. */
  conditions?: string[];
}

// ──────────────────────────────────────────────
// Rulings & Enforcement
// ──────────────────────────────────────────────

/** Who the ruling favors. */
export type RulingOutcome =
  | 'claimant_wins'      // Claimant's claim is upheld
  | 'respondent_wins'    // Respondent is cleared
  | 'partial'            // Split decision
  | 'mutual_settlement'  // Parties agreed during negotiation/mediation
  | 'dismissed';         // Dispute was frivolous or lacked standing

/** Enforcement actions the platform can execute automatically. */
export type EnforcementAction =
  | 'refund'                  // Refund credits to claimant
  | 'penalty'                 // Deduct credits from respondent as penalty
  | 'reputation_adjustment'   // Adjust reputation score
  | 'contract_termination'    // Terminate the related contract
  | 'contract_modification'   // Modify contract terms
  | 'agent_warning'           // Issue formal warning
  | 'agent_suspension'        // Temporary suspension via governance kill switch
  | 'bond_return'             // Return filing bond to claimant
  | 'bond_forfeit'            // Claimant loses filing bond (frivolous claim)
  | 'precedent_creation';     // Create a precedent record for future disputes

/** A single enforcement action to be executed. */
export interface EnforcementDirective {
  /** Action type. */
  action: EnforcementAction;
  /** Target agent for this action. */
  target_agent_id: string;
  /** Amount (for financial actions). */
  amount?: number;
  /** Currency. */
  currency?: string;
  /** Reputation delta (for reputation_adjustment). */
  reputation_delta?: number;
  /** Contract ID (for contract actions). */
  contract_id?: string;
  /** Additional parameters. */
  parameters?: Record<string, unknown>;
  /** Whether this directive has been executed. */
  executed: boolean;
  /** Execution result. */
  execution_result?: string;
  executed_at?: string;
}

/** The arbitrator's formal ruling on a dispute. */
export interface DisputeRuling {
  /** Ruling ID. */
  id: string;
  /** Dispute this ruling applies to. */
  dispute_id: string;
  /** Agent (arbitrator) who issued the ruling. */
  arbitrator_agent_id: string;
  /** Outcome. */
  outcome: RulingOutcome;
  /** Detailed reasoning for the ruling. */
  reasoning: string;
  /** Evidence IDs that were considered. */
  evidence_considered: string[];
  /** Precedent IDs that influenced this ruling. */
  precedents_applied: string[];
  /** Ordered list of enforcement actions. */
  enforcement_directives: EnforcementDirective[];
  /** Confidence score (0-1) — how clear-cut the evidence was. */
  confidence: number;
  /** Whether this ruling can be appealed. */
  is_appealable: boolean;
  /** Appeal deadline (ISO-8601). */
  appeal_deadline?: string;
  created_at: string;
}

// ──────────────────────────────────────────────
// Arbitrator Qualifications
// ──────────────────────────────────────────────

/** Qualification requirements for agents to serve as arbitrators. */
export interface ArbitratorQualification {
  /** Agent ID. */
  agent_id: string;
  /** Whether this agent is qualified to arbitrate. */
  is_qualified: boolean;
  /** Categories this arbitrator is qualified for. */
  qualified_categories: DisputeCategory[];
  /** Minimum trust level required (must be 'partner'). */
  trust_level: string;
  /** Minimum reputation score required (0.7+). */
  min_reputation: number;
  /** Total disputes arbitrated. */
  disputes_arbitrated: number;
  /** Percentage of rulings upheld on appeal. */
  ruling_upheld_rate: number;
  /** Average confidence score across rulings. */
  avg_confidence: number;
  /** Whether this arbitrator is currently available. */
  is_available: boolean;
  /** Conflict of interest check: agent IDs this arbitrator cannot judge. */
  conflict_agent_ids: string[];
  certified_at?: string;
  last_arbitrated_at?: string;
}

// ──────────────────────────────────────────────
// Precedent System
// ──────────────────────────────────────────────

/** A precedent established by a dispute ruling for future reference. */
export interface DisputePrecedent {
  /** Precedent ID. */
  id: string;
  /** Source dispute. */
  dispute_id: string;
  /** Source ruling. */
  ruling_id: string;
  /** Category this precedent applies to. */
  category: DisputeCategory;
  /** Concise principle established. */
  principle: string;
  /** Detailed description of the precedent and its reasoning. */
  description: string;
  /** Key facts that make this precedent applicable. */
  key_facts: string[];
  /** The ruling outcome that established this precedent. */
  outcome: RulingOutcome;
  /** How many times this precedent has been cited. */
  times_cited: number;
  /** Whether this precedent is still considered valid. */
  is_active: boolean;
  /** Superseded by a later precedent (if applicable). */
  superseded_by?: string;
  created_at: string;
}

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

/** Platform-level dispute resolution configuration. */
export const DISPUTE_CONFIG = {
  /** Filing bond as percentage of disputed amount (discourages frivolous claims). */
  filing_bond_percent: 5,
  /** Minimum filing bond in credits. */
  min_filing_bond: 10,
  /** Maximum filing bond in credits. */
  max_filing_bond: 5000,
  /** Default phase timeout in hours. */
  default_phase_timeout_hours: 48,
  /** Maximum negotiation rounds before auto-escalation. */
  default_max_negotiation_rounds: 5,
  /** Appeal window in hours after a ruling. */
  appeal_window_hours: 72,
  /** Minimum arbitrator reputation score. */
  min_arbitrator_reputation: 0.7,
  /** Required arbitrator trust level. */
  required_arbitrator_trust: 'partner' as const,
  /** Number of arbitrators on an appeal panel. */
  appeal_panel_size: 3,
  /** Maximum active disputes per agent. */
  max_active_disputes_per_agent: 10,
} as const;

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/arbitration/disputes — file a new dispute. */
export interface DisputeFileRequest {
  /** Agent the dispute is against. */
  respondent_agent_id: string;
  /** Dispute category. */
  category: DisputeCategory;
  /** Title. */
  title: string;
  /** Detailed description. */
  description: string;
  /** Related contract ID. */
  contract_id?: string;
  /** Related task IDs. */
  task_ids?: string[];
  /** Amount in dispute (credits). */
  amount_disputed: number;
  /** Currency (defaults to 'credits'). */
  currency?: string;
}

export interface DisputeFileResponse {
  dispute_id: string;
  phase: DisputePhase;
  filing_bond: number;
  phase_deadline: string;
  created_at: string;
}

/** POST /api/a2a/arbitration/disputes/:id/evidence — submit evidence. */
export interface EvidenceSubmitRequest {
  /** Which side this evidence supports. */
  side: 'claimant' | 'respondent' | 'neutral';
  /** Evidence type. */
  type: EvidenceType;
  /** Title. */
  title: string;
  /** Evidence content. */
  content: Record<string, unknown>;
}

export interface EvidenceSubmitResponse {
  evidence_id: string;
  content_hash: string;
  created_at: string;
}

/** POST /api/a2a/arbitration/disputes/:id/negotiate — send negotiation message. */
export interface NegotiateRequest {
  message_type: NegotiationMessageType;
  content: string;
  settlement_offer?: SettlementOffer;
}

export interface NegotiateResponse {
  message_id: string;
  round: number;
  phase: DisputePhase;
  /** If an offer was accepted, the dispute moves to enforcement. */
  settled?: boolean;
}

/** POST /api/a2a/arbitration/disputes/:id/escalate — manually escalate to next phase. */
export interface EscalateRequest {
  reason: string;
}

export interface EscalateResponse {
  dispute_id: string;
  previous_phase: DisputePhase;
  new_phase: DisputePhase;
  /** Assigned mediator or arbitrator. */
  assigned_agent_id?: string;
  phase_deadline: string;
}

/** POST /api/a2a/arbitration/disputes/:id/rule — arbitrator issues ruling. */
export interface RuleRequest {
  outcome: RulingOutcome;
  reasoning: string;
  evidence_considered: string[];
  precedents_applied?: string[];
  enforcement_directives: Omit<EnforcementDirective, 'executed' | 'execution_result' | 'executed_at'>[];
  confidence: number;
  /** Whether to create a precedent from this ruling. */
  create_precedent?: boolean;
  /** Precedent principle (if creating). */
  precedent_principle?: string;
  /** Precedent key facts (if creating). */
  precedent_key_facts?: string[];
}

export interface RuleResponse {
  ruling_id: string;
  outcome: RulingOutcome;
  is_appealable: boolean;
  appeal_deadline?: string;
  enforcement_directives: number;
  precedent_id?: string;
}

/** POST /api/a2a/arbitration/disputes/:id/appeal — appeal a ruling. */
export interface AppealRequest {
  reason: string;
  /** New evidence IDs not considered in original ruling. */
  new_evidence_ids?: string[];
}

export interface AppealResponse {
  dispute_id: string;
  phase: DisputePhase;
  appeal_panel_ids: string[];
  phase_deadline: string;
}

/** GET /api/a2a/arbitration/disputes — list disputes. */
export interface DisputeListResponse {
  disputes: Dispute[];
  count: number;
}

/** GET /api/a2a/arbitration/disputes/:id — full dispute detail. */
export interface DisputeDetailResponse {
  dispute: Dispute;
  evidence: DisputeEvidence[];
  messages: DisputeMessage[];
  ruling?: DisputeRuling;
  appeal_ruling?: DisputeRuling;
  precedents_cited: DisputePrecedent[];
}

/** GET /api/a2a/arbitration/precedents — search precedent database. */
export interface PrecedentSearchRequest {
  category?: DisputeCategory;
  keyword?: string;
  limit?: number;
}

export interface PrecedentSearchResponse {
  precedents: DisputePrecedent[];
  count: number;
}

/** POST /api/a2a/arbitration/disputes/:id/withdraw — claimant withdraws. */
export interface WithdrawRequest {
  reason: string;
}

export interface WithdrawResponse {
  dispute_id: string;
  phase: DisputePhase;
  bond_returned: boolean;
  bond_amount: number;
}
