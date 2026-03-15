/**
 * Agent Consensus & Distributed Decision Protocol — Types
 *
 * In 2028, the most critical missing primitive in agent ecosystems is
 * collective decision-making. Individual agents have trust, governance,
 * and identity — but when N agents must jointly decide on shared state
 * transitions, resource allocations, policy changes, or strategic
 * direction, there is no formal protocol.
 *
 * This is the equivalent of TCP for multi-agent agreement: without it,
 * every collective action devolves into ad-hoc negotiation or
 * centralized dictation. Neither scales.
 *
 * The consensus protocol provides:
 *   1. Multiple consensus algorithms (weighted voting, supermajority,
 *      conviction voting, liquid democracy, optimistic approval)
 *   2. Proposal lifecycle with quorum enforcement
 *   3. Vote delegation with transitive chains and anti-loops
 *   4. Veto powers for safety-critical domains
 *   5. Split-brain resolution for partitioned agent networks
 *   6. Time-bounded decisions with automatic resolution
 *   7. Outcome binding with enforcement hooks
 *
 * Decision lifecycle:
 *   Draft → Open → Voting → Decided → Executed | Expired | Vetoed
 *
 * Council critique addressed:
 *   Hinton: "Without consensus, agent collectives are just mobs."
 *   Hassabis: "Game theory demands formal equilibrium mechanisms."
 *   Amodei: "Safety at scale requires collective, not just individual, alignment."
 *   Nadella: "Enterprise adoption requires auditable group decisions."
 */

// ──────────────────────────────────────────────
// Consensus Algorithms
// ──────────────────────────────────────────────

/**
 * Available consensus mechanisms, each suited to different scenarios:
 *
 * - weighted_majority: Votes weighted by trust/reputation. Fast, good default.
 * - supermajority: Requires 2/3+ agreement. For irreversible decisions.
 * - conviction_voting: Votes accumulate weight over time. For resource allocation.
 * - liquid_democracy: Agents delegate votes transitively. For expertise-driven decisions.
 * - optimistic_approval: Passes unless vetoed within timeframe. For low-risk ops.
 * - unanimous: All participants must agree. For safety-critical consensus.
 */
export type ConsensusAlgorithm =
  | 'weighted_majority'
  | 'supermajority'
  | 'conviction_voting'
  | 'liquid_democracy'
  | 'optimistic_approval'
  | 'unanimous';

// ──────────────────────────────────────────────
// Decision Domains
// ──────────────────────────────────────────────

/**
 * Domains requiring collective decision-making.
 * Each domain can have its own quorum, algorithm, and veto rules.
 */
export type DecisionDomain =
  | 'resource_allocation'
  | 'policy_change'
  | 'membership_admission'
  | 'membership_removal'
  | 'capability_deployment'
  | 'emergency_response'
  | 'strategic_planning'
  | 'conflict_resolution'
  | 'budget_approval'
  | 'safety_override'
  | 'protocol_upgrade'
  | 'custom';

export const DECISION_DOMAINS: DecisionDomain[] = [
  'resource_allocation',
  'policy_change',
  'membership_admission',
  'membership_removal',
  'capability_deployment',
  'emergency_response',
  'strategic_planning',
  'conflict_resolution',
  'budget_approval',
  'safety_override',
  'protocol_upgrade',
  'custom',
];

/**
 * Domains where vetoes are automatically enabled regardless of config.
 * These are too dangerous for simple majority rule.
 */
export const SAFETY_CRITICAL_DOMAINS: DecisionDomain[] = [
  'safety_override',
  'membership_removal',
  'emergency_response',
  'protocol_upgrade',
];

// ──────────────────────────────────────────────
// Proposal & Decision Lifecycle
// ──────────────────────────────────────────────

export type ProposalStatus =
  | 'draft'
  | 'open'
  | 'voting'
  | 'decided_approved'
  | 'decided_rejected'
  | 'executed'
  | 'expired'
  | 'vetoed'
  | 'cancelled';

export const TERMINAL_STATUSES: ProposalStatus[] = [
  'decided_approved',
  'decided_rejected',
  'executed',
  'expired',
  'vetoed',
  'cancelled',
];

export interface Proposal {
  id: string;
  /** Agent that created this proposal. */
  proposer_id: string;
  /** The consensus council this belongs to. */
  council_id: string;
  /** Human-readable title. */
  title: string;
  /** Detailed description of what is being decided. */
  description: string;
  /** The domain this decision falls under. */
  domain: DecisionDomain;
  /** Current lifecycle status. */
  status: ProposalStatus;
  /** Consensus algorithm to use. */
  algorithm: ConsensusAlgorithm;
  /** Structured payload: the "what" being decided. */
  payload: Record<string, unknown>;
  /** When voting opens (ISO 8601). */
  voting_opens_at: string;
  /** Deadline for votes (ISO 8601). Proposal expires if quorum not met. */
  voting_closes_at: string;
  /** Required quorum: fraction of eligible voters (0.0 – 1.0). */
  quorum_threshold: number;
  /** Approval threshold: fraction of votes needed to pass (0.0 – 1.0). */
  approval_threshold: number;
  /** Whether veto power is enabled for this proposal. */
  veto_enabled: boolean;
  /** IDs of agents with veto power, if veto_enabled. */
  veto_holders: string[];
  /** Outcome once decided. */
  outcome?: DecisionOutcome;
  /** Created timestamp. */
  created_at: string;
  /** Last updated timestamp. */
  updated_at: string;
}

// ──────────────────────────────────────────────
// Votes
// ──────────────────────────────────────────────

export type VoteChoice = 'approve' | 'reject' | 'abstain' | 'veto';

export interface Vote {
  id: string;
  proposal_id: string;
  voter_id: string;
  choice: VoteChoice;
  /** Weight of this vote (computed from trust/reputation). */
  weight: number;
  /** For conviction voting: how long this vote has been held. */
  conviction_start?: string;
  /** Optional justification. */
  rationale?: string;
  /** If this vote was cast via delegation. */
  delegated_from?: string;
  /** Full delegation chain if transitive. */
  delegation_chain: string[];
  created_at: string;
}

// ──────────────────────────────────────────────
// Vote Delegation
// ──────────────────────────────────────────────

export interface VoteDelegation {
  id: string;
  /** Agent delegating their vote. */
  delegator_id: string;
  /** Agent receiving the delegated vote. */
  delegate_id: string;
  /** Optional: restrict delegation to specific domains. */
  domains: DecisionDomain[];
  /** Optional: restrict delegation to a specific council. */
  council_id?: string;
  /** Whether this delegation can be further delegated (transitive). */
  transitive: boolean;
  /** Maximum delegation chain depth (prevents infinite loops). */
  max_depth: number;
  /** Active period. */
  active_from: string;
  active_until?: string;
  /** Is this delegation currently active? */
  revoked: boolean;
  created_at: string;
}

// ──────────────────────────────────────────────
// Consensus Council
// ──────────────────────────────────────────────

/**
 * A Consensus Council is a named group of agents that collectively
 * makes decisions. Think: board of directors, safety committee,
 * resource allocation panel, or emergency response team.
 */
export interface ConsensusCouncil {
  id: string;
  name: string;
  description: string;
  /** Domains this council governs. */
  domains: DecisionDomain[];
  /** Member agents and their roles. */
  members: CouncilMember[];
  /** Default consensus algorithm. */
  default_algorithm: ConsensusAlgorithm;
  /** Default quorum threshold. */
  default_quorum: number;
  /** Default approval threshold. */
  default_approval_threshold: number;
  /** Per-domain overrides. */
  domain_overrides: DomainConfig[];
  /** Whether the council is active. */
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type CouncilRole = 'chair' | 'member' | 'observer' | 'veto_holder';

export interface CouncilMember {
  agent_id: string;
  role: CouncilRole;
  /** Voting weight multiplier (1.0 = normal). */
  weight_multiplier: number;
  /** Domains this member can vote on (empty = all council domains). */
  voting_domains: DecisionDomain[];
  joined_at: string;
}

export interface DomainConfig {
  domain: DecisionDomain;
  algorithm: ConsensusAlgorithm;
  quorum_threshold: number;
  approval_threshold: number;
  veto_enabled: boolean;
  /** Max voting duration in seconds. */
  max_voting_duration_seconds: number;
}

// ──────────────────────────────────────────────
// Decision Outcome
// ──────────────────────────────────────────────

export interface DecisionOutcome {
  /** Whether the proposal was approved. */
  approved: boolean;
  /** Final tally. */
  tally: VoteTally;
  /** If vetoed, by whom and why. */
  veto_info?: VetoInfo;
  /** How the outcome was determined. */
  resolution_method: ResolutionMethod;
  /** Binding actions triggered by this decision. */
  enforcement_actions: EnforcementAction[];
  resolved_at: string;
}

export interface VoteTally {
  total_eligible: number;
  total_cast: number;
  approve_weight: number;
  reject_weight: number;
  abstain_weight: number;
  veto_count: number;
  quorum_met: boolean;
  approval_ratio: number;
}

export interface VetoInfo {
  vetoer_id: string;
  reason: string;
  vetoed_at: string;
}

export type ResolutionMethod =
  | 'quorum_vote'
  | 'veto_exercised'
  | 'expired_no_quorum'
  | 'unanimous_early'
  | 'optimistic_no_objection'
  | 'conviction_threshold'
  | 'cancelled_by_proposer';

// ──────────────────────────────────────────────
// Enforcement
// ──────────────────────────────────────────────

/**
 * Actions automatically triggered when a proposal is decided.
 * This makes consensus outcomes binding, not advisory.
 */
export type EnforcementActionType =
  | 'execute_workflow'
  | 'update_policy'
  | 'allocate_resources'
  | 'modify_membership'
  | 'emit_event'
  | 'invoke_webhook'
  | 'custom';

export interface EnforcementAction {
  type: EnforcementActionType;
  /** Structured payload for the action. */
  config: Record<string, unknown>;
  /** Whether this action has been executed. */
  executed: boolean;
  /** Execution result if completed. */
  result?: Record<string, unknown>;
  executed_at?: string;
}

// ──────────────────────────────────────────────
// Conviction Voting State
// ──────────────────────────────────────────────

/**
 * Conviction voting accumulates weight over time. A vote held for
 * longer carries more weight, encouraging conviction over impulse.
 * Used primarily for resource_allocation decisions.
 */
export interface ConvictionState {
  proposal_id: string;
  voter_id: string;
  /** Raw vote weight. */
  base_weight: number;
  /** Accumulated conviction (increases with time). */
  accumulated_conviction: number;
  /** Half-life in seconds for conviction decay if vote is changed. */
  half_life_seconds: number;
  /** When conviction started accumulating. */
  conviction_start: string;
  last_computed_at: string;
}

// ──────────────────────────────────────────────
// Split-Brain Resolution
// ──────────────────────────────────────────────

/**
 * When agent networks partition, two sub-groups may reach conflicting
 * decisions. Split-brain resolution defines how to reconcile.
 */
export type SplitBrainStrategy =
  | 'highest_quorum_wins'
  | 'chair_partition_wins'
  | 'latest_timestamp_wins'
  | 'merge_and_revote'
  | 'manual_resolution';

export interface SplitBrainEvent {
  id: string;
  council_id: string;
  proposal_id: string;
  /** The conflicting partitions and their decisions. */
  partitions: PartitionDecision[];
  strategy: SplitBrainStrategy;
  resolution?: SplitBrainResolution;
  detected_at: string;
}

export interface PartitionDecision {
  partition_id: string;
  member_ids: string[];
  outcome: DecisionOutcome;
}

export interface SplitBrainResolution {
  winning_partition_id?: string;
  /** If merge_and_revote, the new proposal id. */
  revote_proposal_id?: string;
  resolved_by: string;
  resolved_at: string;
  resolution_notes: string;
}

// ──────────────────────────────────────────────
// Audit Log
// ──────────────────────────────────────────────

export type ConsensusEventType =
  | 'proposal_created'
  | 'proposal_opened'
  | 'vote_cast'
  | 'vote_delegated'
  | 'delegation_created'
  | 'delegation_revoked'
  | 'veto_exercised'
  | 'quorum_reached'
  | 'proposal_decided'
  | 'proposal_executed'
  | 'proposal_expired'
  | 'proposal_cancelled'
  | 'split_brain_detected'
  | 'split_brain_resolved'
  | 'council_created'
  | 'council_member_added'
  | 'council_member_removed'
  | 'conviction_updated';

export interface ConsensusAuditEntry {
  id: string;
  event_type: ConsensusEventType;
  council_id: string;
  proposal_id?: string;
  actor_id: string;
  details: Record<string, unknown>;
  timestamp: string;
}
