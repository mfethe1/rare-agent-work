/**
 * A2A Agent Ensemble Protocol — Types
 *
 * Enables agents to dynamically compose into higher-order "meta-agents" —
 * ensembles that accept tasks as a unified entity, distribute work internally,
 * reach consensus on outputs, and dissolve when no longer needed.
 *
 * This is the critical missing piece for 2028: individual agents hit capability
 * ceilings. Ensembles break through them by combining complementary skills,
 * cross-validating outputs, and presenting a single coherent interface to the
 * outside world.
 *
 * Key concepts:
 *
 * 1. **Formation** — Agents assemble based on capability coverage for a goal.
 *    A formation strategy (manual, capability-match, auction) determines how
 *    members are recruited.
 *
 * 2. **Roles** — Each member has a role: coordinator (orchestrates), specialist
 *    (executes), validator (checks outputs), critic (adversarial review), or
 *    observer (read-only).
 *
 * 3. **Shared Identity** — The ensemble registers as a first-class agent with
 *    its own ID, capabilities (union of members), and callback URL. External
 *    callers don't need to know it's an ensemble.
 *
 * 4. **Internal Consensus** — Before publishing a result, members vote on the
 *    output. The ensemble's consensus policy (majority, unanimous, weighted,
 *    coordinator-decides) determines when agreement is reached.
 *
 * 5. **Lifecycle** — forming → active → quorum_lost → dissolving → dissolved.
 *    Ensembles can scale members up/down while active.
 *
 * 6. **Knowledge Preservation** — On dissolution, the ensemble's learned context
 *    is persisted to the knowledge graph so future ensembles benefit.
 */

// ── Ensemble Lifecycle ──────────────────────────────────────────────────────

export type EnsembleStatus =
  | 'forming'      // Recruiting members, not yet accepting tasks
  | 'active'       // Fully operational, accepting tasks
  | 'quorum_lost'  // Below minimum members, paused until recovered
  | 'dissolving'   // Gracefully shutting down, finishing in-flight tasks
  | 'dissolved';   // Terminal state, knowledge preserved

// ── Member Roles ────────────────────────────────────────────────────────────

export type MemberRole =
  | 'coordinator'  // Orchestrates internal task distribution and consensus
  | 'specialist'   // Executes tasks in their domain of expertise
  | 'validator'    // Reviews and validates outputs before publication
  | 'critic'       // Adversarial review — finds flaws, edge cases, biases
  | 'observer';    // Read-only access to ensemble activity (for monitoring)

export type MemberStatus =
  | 'invited'      // Invitation sent, awaiting acceptance
  | 'active'       // Participating in ensemble
  | 'suspended'    // Temporarily removed (e.g., health check failure)
  | 'departed';    // Left or was removed

// ── Formation Strategy ──────────────────────────────────────────────────────

export type FormationStrategy =
  | 'manual'            // Creator explicitly invites specific agents
  | 'capability_match'  // Platform auto-recruits agents matching required capabilities
  | 'auction'           // Broadcast a formation request; agents bid to join
  | 'reputation_top_n'; // Auto-recruit top N agents by reputation for each capability

// ── Consensus Policy ────────────────────────────────────────────────────────

export type ConsensusPolicy =
  | 'majority'            // >50% of voting members agree
  | 'supermajority'       // >=2/3 of voting members agree
  | 'unanimous'           // All voting members agree
  | 'weighted_reputation' // Votes weighted by member reputation score
  | 'coordinator_decides' // Coordinator has final say (fastest, least robust)
  | 'validator_gate';     // All validators must approve (validators have veto)

// ── Core Types ──────────────────────────────────────────────────────────────

/** An agent ensemble — a dynamic team that acts as a unified agent. */
export interface AgentEnsemble {
  /** Unique ensemble ID. */
  id: string;
  /** Human-readable name (e.g., "Legal Analysis Team Alpha"). */
  name: string;
  /** What this ensemble is formed to accomplish. */
  goal: string;
  /** The ensemble's registered agent ID in the agent registry. */
  agent_id: string;
  /** Agent who initiated the formation. */
  created_by: string;
  status: EnsembleStatus;
  /** How members were recruited. */
  formation_strategy: FormationStrategy;
  /** How the ensemble reaches agreement on outputs. */
  consensus_policy: ConsensusPolicy;
  /** Minimum active members required to remain operational. */
  min_quorum: number;
  /** Maximum members allowed. */
  max_members: number;
  /** Union of all active member capabilities. */
  capabilities: string[];
  /** Tags for discovery (e.g., ["legal", "analysis", "multi-jurisdiction"]). */
  tags: string[];
  /** Auto-dissolve after this many seconds of inactivity. */
  idle_timeout_seconds: number;
  /** Total tasks completed by this ensemble. */
  tasks_completed: number;
  /** Average quality rating across completed tasks. */
  avg_quality: number;
  created_at: string;
  updated_at: string;
  dissolved_at: string | null;
}

/** A member within an ensemble. */
export interface EnsembleMember {
  ensemble_id: string;
  agent_id: string;
  role: MemberRole;
  status: MemberStatus;
  /** Capabilities this member contributes to the ensemble. */
  contributed_capabilities: string[];
  /** Member's reputation score at time of joining (for weighted consensus). */
  reputation_at_join: number;
  /** Number of internal tasks assigned to this member. */
  tasks_assigned: number;
  /** Number of consensus votes cast. */
  votes_cast: number;
  joined_at: string;
  updated_at: string;
  departed_at: string | null;
  /** Why the member departed (if applicable). */
  departure_reason: string | null;
}

/** An internal task distributed within the ensemble. */
export interface EnsembleInternalTask {
  id: string;
  ensemble_id: string;
  /** The external task that triggered this internal work. */
  external_task_id: string | null;
  /** Member assigned to execute. */
  assigned_to: string;
  /** What the member should do. */
  instruction: string;
  /** Input data for the member. */
  input: Record<string, unknown>;
  /** Member's output (populated on completion). */
  output: Record<string, unknown> | null;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  created_at: string;
  completed_at: string | null;
}

/** A consensus round — members vote on an ensemble output before publication. */
export interface ConsensusRound {
  id: string;
  ensemble_id: string;
  /** The external task this consensus is for. */
  external_task_id: string;
  /** The proposed output being voted on. */
  proposed_output: Record<string, unknown>;
  /** Who proposed this output (usually the specialist or coordinator). */
  proposed_by: string;
  status: 'open' | 'approved' | 'rejected' | 'revised';
  /** The consensus policy in effect for this round. */
  policy: ConsensusPolicy;
  /** Minimum votes needed (computed from policy + active members). */
  required_votes: number;
  /** Round number (starts at 1, increments on revision). */
  round_number: number;
  /** Max rounds before escalation or coordinator override. */
  max_rounds: number;
  created_at: string;
  resolved_at: string | null;
}

/** A member's vote in a consensus round. */
export interface ConsensusVote {
  round_id: string;
  agent_id: string;
  /** Approve the proposed output, reject it, or request revision. */
  decision: 'approve' | 'reject' | 'revise';
  /** Why (especially important for reject/revise). */
  rationale: string;
  /** Suggested changes if decision is 'revise'. */
  suggested_changes: Record<string, unknown> | null;
  /** Agent's confidence in their vote (0.0 - 1.0). */
  confidence: number;
  created_at: string;
}

/** Consensus tally for a round. */
export interface ConsensusTally {
  round_id: string;
  total_eligible: number;
  total_votes: number;
  approvals: number;
  rejections: number;
  revisions: number;
  /** Weighted score (for weighted_reputation policy). */
  weighted_approval_score: number;
  /** Whether the policy threshold is met. */
  threshold_met: boolean;
  /** The decision reached (null if still open). */
  decision: 'approved' | 'rejected' | 'revision_needed' | null;
}

/** Record of an ensemble dissolution — preserves learnings. */
export interface EnsembleDissolution {
  ensemble_id: string;
  reason: 'goal_complete' | 'idle_timeout' | 'quorum_lost' | 'manual' | 'policy_violation';
  /** Summary of what was accomplished. */
  accomplishment_summary: string;
  /** Key learnings to persist to knowledge graph. */
  learnings: string[];
  /** Knowledge node IDs created from this ensemble's work. */
  knowledge_node_ids: string[];
  /** Final member roster at dissolution. */
  final_members: Array<{ agent_id: string; role: MemberRole; tasks_completed: number }>;
  dissolved_at: string;
}

// ── API Request / Response Types ────────────────────────────────────────────

export interface CreateEnsembleRequest {
  name: string;
  goal: string;
  formation_strategy: FormationStrategy;
  consensus_policy: ConsensusPolicy;
  min_quorum?: number;
  max_members?: number;
  tags?: string[];
  idle_timeout_seconds?: number;
  /** For manual formation: agent IDs to invite. */
  invite_agents?: string[];
  /** For capability_match / reputation_top_n: required capabilities. */
  required_capabilities?: string[];
  /** For reputation_top_n: how many agents per capability. */
  top_n?: number;
}

export interface CreateEnsembleResponse {
  ensemble: AgentEnsemble;
  members: EnsembleMember[];
  /** The ensemble's agent registry ID (for external callers). */
  agent_id: string;
}

export interface InviteMemberRequest {
  agent_id: string;
  role: MemberRole;
}

export interface InviteMemberResponse {
  member: EnsembleMember;
  ensemble_capabilities: string[];
}

export interface AcceptInviteResponse {
  member: EnsembleMember;
  ensemble: AgentEnsemble;
}

export interface ProposeOutputRequest {
  external_task_id: string;
  proposed_output: Record<string, unknown>;
  max_rounds?: number;
}

export interface ProposeOutputResponse {
  round: ConsensusRound;
}

export interface VoteRequest {
  decision: 'approve' | 'reject' | 'revise';
  rationale: string;
  suggested_changes?: Record<string, unknown>;
  confidence?: number;
}

export interface VoteResponse {
  round_id: string;
  tally: ConsensusTally;
  resolved: boolean;
  decision: 'approved' | 'rejected' | 'revision_needed' | null;
}

export interface DissolveRequest {
  reason: 'goal_complete' | 'manual';
  accomplishment_summary?: string;
  learnings?: string[];
}

export interface DissolveResponse {
  dissolution: EnsembleDissolution;
}

export interface ListEnsemblesResponse {
  ensembles: AgentEnsemble[];
  count: number;
}

export interface GetEnsembleResponse {
  ensemble: AgentEnsemble;
  members: EnsembleMember[];
  active_rounds: ConsensusRound[];
}
