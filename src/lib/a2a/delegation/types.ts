/**
 * A2A Agent Delegation & Scoped Authorization — Types
 *
 * Enables agents to grant other agents explicit, time-bounded, revocable
 * permissions to act on their behalf. This is the trust-chain primitive
 * that powers hierarchical agent teams, automated sub-contracting, and
 * delegated task execution.
 *
 * Use cases:
 *   - A manager agent delegates "task.submit" to a worker agent
 *   - A billing agent grants read-only ledger access to an auditor
 *   - A workflow orchestrator delegates specific capabilities to step agents
 *   - An agent going offline delegates its contracts to a backup agent
 *
 * Delegation lifecycle:
 *   pending → active → expired | revoked
 *
 * Security model:
 *   - Delegations are scoped to specific actions (not blanket access)
 *   - Delegations can restrict to specific resource IDs (e.g., one contract)
 *   - Delegations are time-bounded with mandatory expiry
 *   - Max delegation depth prevents infinite chains (default: 2)
 *   - Delegations can be revoked instantly by the grantor
 *   - All delegated actions are audit-logged with the full delegation chain
 */

// ──────────────────────────────────────────────
// Delegation
// ──────────────────────────────────────────────

export type DelegationStatus = 'pending' | 'active' | 'expired' | 'revoked';

/**
 * Actions that can be delegated. Each maps to an API operation.
 * Agents can only delegate actions they themselves have permission to perform.
 */
export type DelegatableAction =
  | 'task.submit'          // Submit tasks on behalf of grantor
  | 'task.update'          // Update task status
  | 'task.read'            // Read task details
  | 'billing.read'         // Read wallet/transactions
  | 'billing.spend'        // Spend from grantor's wallet (up to limit)
  | 'contract.negotiate'   // Negotiate contracts on behalf of grantor
  | 'contract.read'        // Read contract details
  | 'auction.bid'          // Place bids on behalf of grantor
  | 'auction.create'       // Create auctions on behalf of grantor
  | 'context.read'         // Read shared context
  | 'context.write'        // Write shared context
  | 'channel.send'         // Send messages in channels grantor belongs to
  | 'profile.read'         // Read grantor's profile
  | 'workflow.trigger';    // Trigger workflows on behalf of grantor

/** A scoped delegation of authority from one agent to another. */
export interface AgentDelegation {
  /** Platform-assigned delegation ID (UUID). */
  id: string;
  /** Agent granting the delegation (the principal). */
  grantor_agent_id: string;
  /** Agent receiving the delegation (the delegate). */
  delegate_agent_id: string;
  /** Actions the delegate is authorized to perform. */
  scopes: DelegatableAction[];
  /** Optional: restrict delegation to specific resource IDs. */
  resource_ids?: string[];
  /** Current status. */
  status: DelegationStatus;
  /** Maximum amount the delegate can spend per action (for billing.spend). */
  spend_limit_per_action?: number;
  /** Maximum total amount the delegate can spend (for billing.spend). */
  spend_limit_total?: number;
  /** Amount already spent under this delegation. */
  spent_total: number;
  /** Whether the delegate can further sub-delegate (chain depth). */
  allow_subdelegation: boolean;
  /** Current depth in the delegation chain (0 = direct delegation). */
  chain_depth: number;
  /** Maximum allowed chain depth. */
  max_chain_depth: number;
  /** Parent delegation ID (if this is a sub-delegation). */
  parent_delegation_id?: string;
  /** Human-readable reason for the delegation. */
  reason: string;
  /** When the delegation becomes active (ISO-8601). */
  starts_at: string;
  /** When the delegation expires (ISO-8601). Mandatory. */
  expires_at: string;
  /** ISO-8601 timestamps. */
  created_at: string;
  revoked_at?: string;
}

/** A log entry for every action performed under a delegation. */
export interface DelegationAuditEntry {
  id: string;
  delegation_id: string;
  grantor_agent_id: string;
  delegate_agent_id: string;
  action: DelegatableAction;
  resource_id?: string;
  /** The full delegation chain (for sub-delegations). */
  chain: string[];
  /** Whether the action was allowed. */
  allowed: boolean;
  /** Reason if denied. */
  denial_reason?: string;
  /** Amount spent (for billing.spend actions). */
  spend_amount?: number;
  created_at: string;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/delegations — create a new delegation. */
export interface DelegationCreateRequest {
  delegate_agent_id: string;
  scopes: DelegatableAction[];
  resource_ids?: string[];
  spend_limit_per_action?: number;
  spend_limit_total?: number;
  allow_subdelegation?: boolean;
  max_chain_depth?: number;
  reason: string;
  starts_at?: string;
  expires_at: string;
}

export interface DelegationCreateResponse {
  delegation_id: string;
  status: DelegationStatus;
  created_at: string;
}

/** GET /api/a2a/delegations — list delegations. */
export interface DelegationListResponse {
  delegations: AgentDelegation[];
  count: number;
}

/** POST /api/a2a/delegations/:id/revoke — revoke a delegation. */
export interface DelegationRevokeResponse {
  delegation_id: string;
  status: DelegationStatus;
  revoked_at: string;
}

/** POST /api/a2a/delegations/check — check if an action is authorized. */
export interface DelegationCheckRequest {
  /** The agent attempting the action (delegate). */
  delegate_agent_id: string;
  /** The agent on whose behalf the action is performed (grantor). */
  grantor_agent_id: string;
  /** The action being attempted. */
  action: DelegatableAction;
  /** Optional resource ID to check. */
  resource_id?: string;
  /** Amount to spend (for billing.spend). */
  spend_amount?: number;
}

export interface DelegationCheckResponse {
  allowed: boolean;
  delegation_id?: string;
  chain?: string[];
  denial_reason?: string;
  remaining_spend_limit?: number;
}
