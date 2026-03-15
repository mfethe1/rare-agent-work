/**
 * Agent Governance Framework — Types
 *
 * Provides autonomy levels, declarative policy constraints, escalation
 * protocols, audit trails, and kill switches for agent operations.
 *
 * In a 2028 agentic ecosystem, governance is the difference between
 * a thriving agent economy and catastrophic autonomous failures.
 *
 * Governance lifecycle:
 *   Policy created → attached to agent → actions evaluated against policy
 *   → allowed / denied / escalated → audit logged
 *
 * Autonomy ladder:
 *   observe → suggest → act_with_approval → autonomous
 */

// ──────────────────────────────────────────────
// Autonomy Levels
// ──────────────────────────────────────────────

/**
 * Autonomy levels, ordered from most restricted to most free.
 *
 * - observe:             Agent can read data but cannot take any actions.
 * - suggest:             Agent can propose actions but requires external approval.
 * - act_with_approval:   Agent can act on pre-approved action types; novel actions require approval.
 * - autonomous:          Agent can act freely within policy constraints.
 */
export type AutonomyLevel = 'observe' | 'suggest' | 'act_with_approval' | 'autonomous';

/** Numeric weight for comparison (higher = more autonomy). */
export const AUTONOMY_RANK: Record<AutonomyLevel, number> = {
  observe: 0,
  suggest: 1,
  act_with_approval: 2,
  autonomous: 3,
};

// ──────────────────────────────────────────────
// Governance Policies
// ──────────────────────────────────────────────

/** Categorized action types that policies can gate. */
export type GovernedAction =
  | 'task.submit'
  | 'task.update'
  | 'context.store'
  | 'context.delete'
  | 'channel.create'
  | 'channel.message'
  | 'workflow.trigger'
  | 'contract.propose'
  | 'contract.negotiate'
  | 'contract.terminate'
  | 'agent.register';

/** Time window restriction for when actions are permitted. */
export interface TimeWindow {
  /** Days of week (0=Sunday, 6=Saturday). Empty = all days. */
  days_of_week: number[];
  /** Start hour (0-23) in UTC. */
  start_hour_utc: number;
  /** End hour (0-23) in UTC. */
  end_hour_utc: number;
}

/** Spending limit constraint. */
export interface SpendLimit {
  /** Maximum credits/cost per day. */
  max_daily_spend: number;
  /** Maximum credits/cost per single action. */
  max_per_action_spend: number;
  /** Currency (matches contract pricing currency). */
  currency: string;
}

/** A declarative governance policy attached to an agent. */
export interface GovernancePolicy {
  /** Platform-assigned policy ID (UUID). */
  id: string;
  /** Human-readable policy name. */
  name: string;
  /** Description of what this policy governs. */
  description: string;
  /** Agent this policy applies to. */
  agent_id: string;
  /** The autonomy level this policy grants/restricts to. */
  autonomy_level: AutonomyLevel;
  /** Actions explicitly allowed (whitelist). Empty = all allowed at autonomy level. */
  allowed_actions: GovernedAction[];
  /** Actions explicitly denied (blacklist, takes precedence over allowed). */
  denied_actions: GovernedAction[];
  /** Intent patterns the agent is allowed to execute (glob-style). Empty = all. */
  allowed_intents: string[];
  /** Intent patterns the agent is explicitly denied. */
  denied_intents: string[];
  /** Agent IDs this agent is allowed to interact with. Empty = all. */
  allowed_targets: string[];
  /** Agent IDs this agent is explicitly denied interaction with. */
  denied_targets: string[];
  /** Optional spending constraints. */
  spend_limit?: SpendLimit;
  /** Optional time window restrictions. */
  time_windows: TimeWindow[];
  /** ID of the supervisor agent or human who handles escalations. */
  escalation_target_id: string;
  /** Whether this policy is currently active. */
  is_active: boolean;
  /** Priority (higher = evaluated first when multiple policies exist). */
  priority: number;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// Policy Evaluation
// ──────────────────────────────────────────────

/** The outcome of evaluating an action against governance policies. */
export type PolicyDecision = 'allow' | 'deny' | 'escalate';

/** Detailed result of a policy evaluation. */
export interface PolicyEvaluation {
  /** Final decision. */
  decision: PolicyDecision;
  /** Which policy made the decision. */
  policy_id: string;
  /** Policy name for human readability. */
  policy_name: string;
  /** Why this decision was reached. */
  reason: string;
  /** The autonomy level that was applied. */
  autonomy_level: AutonomyLevel;
  /** If escalated, who should handle it. */
  escalation_target_id?: string;
}

/** Request to evaluate an action against governance. */
export interface EvaluationRequest {
  /** Agent attempting the action. */
  agent_id: string;
  /** The governed action type. */
  action: GovernedAction;
  /** The specific intent (for task actions). */
  intent?: string;
  /** The target agent (if applicable). */
  target_agent_id?: string;
  /** Estimated cost of the action (for spend limits). */
  estimated_cost?: number;
  /** Additional context for audit. */
  metadata?: Record<string, unknown>;
}

// ──────────────────────────────────────────────
// Escalation
// ──────────────────────────────────────────────

export type EscalationStatus = 'pending' | 'approved' | 'denied' | 'expired';

/** An escalation request created when an action requires approval. */
export interface EscalationRequest {
  /** Platform-assigned escalation ID (UUID). */
  id: string;
  /** The original evaluation request that triggered escalation. */
  agent_id: string;
  /** The action that needs approval. */
  action: GovernedAction;
  /** Intent (if applicable). */
  intent?: string;
  /** Target agent (if applicable). */
  target_agent_id?: string;
  /** Who should approve this (agent or human ID). */
  escalation_target_id: string;
  /** The policy that triggered escalation. */
  policy_id: string;
  /** Current status. */
  status: EscalationStatus;
  /** Why escalation was triggered. */
  reason: string;
  /** Approval/denial rationale from the reviewer. */
  reviewer_rationale?: string;
  /** Additional context. */
  metadata?: Record<string, unknown>;
  /** TTL in seconds — auto-expires to 'denied' if not resolved. */
  ttl_seconds: number;
  expires_at: string;
  created_at: string;
  resolved_at?: string;
}

// ──────────────────────────────────────────────
// Audit Log
// ──────────────────────────────────────────────

/** Immutable audit record for every governed action. */
export interface GovernanceAuditEntry {
  /** Platform-assigned audit ID (UUID). */
  id: string;
  /** Agent that performed or attempted the action. */
  agent_id: string;
  /** The action type. */
  action: GovernedAction;
  /** The governance decision. */
  decision: PolicyDecision;
  /** Policy that made the decision. */
  policy_id: string;
  /** Escalation ID (if escalated). */
  escalation_id?: string;
  /** Intent (if applicable). */
  intent?: string;
  /** Target agent (if applicable). */
  target_agent_id?: string;
  /** Full reason for the decision. */
  reason: string;
  /** Snapshot of context at decision time. */
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ──────────────────────────────────────────────
// Kill Switch
// ──────────────────────────────────────────────

export type SuspensionStatus = 'active' | 'lifted';

/** A kill switch suspension record. */
export interface AgentSuspension {
  id: string;
  /** Agent that is suspended. */
  agent_id: string;
  /** Who initiated the suspension. */
  suspended_by: string;
  /** Reason for suspension. */
  reason: string;
  /** Whether this suspension is active or has been lifted. */
  status: SuspensionStatus;
  /** How many active tasks were cancelled. */
  tasks_cancelled: number;
  /** How many active workflows were paused. */
  workflows_paused: number;
  /** How many active contracts were frozen. */
  contracts_frozen: number;
  created_at: string;
  lifted_at?: string;
  lifted_by?: string;
  lift_reason?: string;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/governance/policies — create a governance policy. */
export interface PolicyCreateRequest {
  name: string;
  description: string;
  agent_id: string;
  autonomy_level: AutonomyLevel;
  allowed_actions?: GovernedAction[];
  denied_actions?: GovernedAction[];
  allowed_intents?: string[];
  denied_intents?: string[];
  allowed_targets?: string[];
  denied_targets?: string[];
  spend_limit?: SpendLimit;
  time_windows?: TimeWindow[];
  escalation_target_id: string;
  priority?: number;
}

export interface PolicyCreateResponse {
  policy_id: string;
  agent_id: string;
  autonomy_level: AutonomyLevel;
  is_active: boolean;
  created_at: string;
}

/** GET /api/a2a/governance/policies — list policies. */
export interface PolicyListResponse {
  policies: GovernancePolicy[];
  count: number;
}

/** POST /api/a2a/governance/evaluate — evaluate an action. */
export interface EvaluateRequest {
  action: GovernedAction;
  intent?: string;
  target_agent_id?: string;
  estimated_cost?: number;
  metadata?: Record<string, unknown>;
}

export interface EvaluateResponse {
  evaluation: PolicyEvaluation;
  escalation_id?: string;
  audit_id: string;
}

/** POST /api/a2a/governance/escalations/:id/resolve — resolve an escalation. */
export interface EscalationResolveRequest {
  decision: 'approved' | 'denied';
  rationale?: string;
}

export interface EscalationResolveResponse {
  escalation_id: string;
  status: EscalationStatus;
  resolved_at: string;
}

/** GET /api/a2a/governance/audit — query audit log. */
export interface AuditListResponse {
  entries: GovernanceAuditEntry[];
  count: number;
}

/** POST /api/a2a/governance/kill-switch — suspend an agent. */
export interface KillSwitchRequest {
  agent_id: string;
  reason: string;
}

export interface KillSwitchResponse {
  suspension_id: string;
  agent_id: string;
  tasks_cancelled: number;
  workflows_paused: number;
  contracts_frozen: number;
  created_at: string;
}

/** POST /api/a2a/governance/kill-switch/:id/lift — lift a suspension. */
export interface KillSwitchLiftRequest {
  reason: string;
}

export interface KillSwitchLiftResponse {
  suspension_id: string;
  agent_id: string;
  status: SuspensionStatus;
  lifted_at: string;
}
