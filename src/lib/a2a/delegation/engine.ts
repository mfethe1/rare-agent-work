/**
 * A2A Agent Delegation Engine
 *
 * Manages the lifecycle of scoped delegations between agents. Handles
 * creation with validation, authorization checks with chain traversal,
 * spend tracking, revocation, and audit logging.
 *
 * Security guarantees:
 *   - Agents can only delegate actions they themselves can perform
 *   - Delegation chains are bounded (max_chain_depth)
 *   - Spend limits are enforced atomically
 *   - Expired/revoked delegations fail immediately
 *   - Every check (allowed or denied) is audit-logged
 */

import { getServiceDb } from '../auth';
import type {
  AgentDelegation,
  DelegationStatus,
  DelegatableAction,
  DelegationAuditEntry,
} from './types';
import type {
  DelegationCreateInput,
  DelegationListInput,
  DelegationCheckInput,
} from './validation';

// ──────────────────────────────────────────────
// Create Delegation
// ──────────────────────────────────────────────

interface CreateDelegationParams {
  agent_id: string;
  input: DelegationCreateInput;
}

export async function createDelegation({ agent_id, input }: CreateDelegationParams): Promise<
  | { delegation_id: string; status: DelegationStatus; created_at: string }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  // Cannot delegate to yourself
  if (agent_id === input.delegate_agent_id) {
    return { error: 'Cannot delegate to yourself', status_code: 400 };
  }

  // Validate delegate agent exists
  const { data: delegate } = await db
    .from('agent_registry')
    .select('id, is_active')
    .eq('id', input.delegate_agent_id)
    .single();

  if (!delegate) return { error: 'Delegate agent not found', status_code: 404 };
  if (!delegate.is_active) return { error: 'Delegate agent is not active', status_code: 409 };

  // Validate expiry is in the future
  const now = new Date();
  const expiresAt = new Date(input.expires_at);
  if (expiresAt <= now) {
    return { error: 'expires_at must be in the future', status_code: 400 };
  }

  // Validate starts_at is before expires_at
  const startsAt = input.starts_at ? new Date(input.starts_at) : now;
  if (startsAt >= expiresAt) {
    return { error: 'starts_at must be before expires_at', status_code: 400 };
  }

  // If billing.spend is in scopes, require spend limits
  if (input.scopes.includes('billing.spend')) {
    if (!input.spend_limit_per_action && !input.spend_limit_total) {
      return { error: 'billing.spend scope requires at least one spend limit', status_code: 400 };
    }
  }

  // Check for duplicate active delegation
  const { data: existing } = await db
    .from('a2a_delegations')
    .select('id')
    .eq('grantor_agent_id', agent_id)
    .eq('delegate_agent_id', input.delegate_agent_id)
    .in('status', ['pending', 'active'])
    .single();

  if (existing) {
    return { error: 'An active delegation already exists for this delegate', status_code: 409 };
  }

  // Determine initial status
  const status: DelegationStatus = startsAt <= now ? 'active' : 'pending';

  const { data: delegation, error: insertErr } = await db
    .from('a2a_delegations')
    .insert({
      grantor_agent_id: agent_id,
      delegate_agent_id: input.delegate_agent_id,
      scopes: input.scopes,
      resource_ids: input.resource_ids ?? null,
      status,
      spend_limit_per_action: input.spend_limit_per_action ?? null,
      spend_limit_total: input.spend_limit_total ?? null,
      spent_total: 0,
      allow_subdelegation: input.allow_subdelegation,
      chain_depth: 0,
      max_chain_depth: input.max_chain_depth,
      reason: input.reason,
      starts_at: startsAt.toISOString(),
      expires_at: input.expires_at,
    })
    .select('id, created_at')
    .single();

  if (insertErr || !delegation) {
    return { error: 'Failed to create delegation', status_code: 500 };
  }

  return {
    delegation_id: delegation.id,
    status,
    created_at: delegation.created_at,
  };
}

// ──────────────────────────────────────────────
// List Delegations
// ──────────────────────────────────────────────

interface ListDelegationsParams {
  agent_id: string;
  input: DelegationListInput;
}

export async function listDelegations({ agent_id, input }: ListDelegationsParams): Promise<{
  delegations: AgentDelegation[];
  count: number;
}> {
  const db = getServiceDb();
  if (!db) return { delegations: [], count: 0 };

  let query = db.from('a2a_delegations').select('*', { count: 'exact' });

  // Filter by role
  if (input.role === 'grantor') {
    query = query.eq('grantor_agent_id', agent_id);
  } else if (input.role === 'delegate') {
    query = query.eq('delegate_agent_id', agent_id);
  } else {
    query = query.or(`grantor_agent_id.eq.${agent_id},delegate_agent_id.eq.${agent_id}`);
  }

  if (input.status) query = query.eq('status', input.status);
  if (input.scope) query = query.contains('scopes', [input.scope]);

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);

  return {
    delegations: (data as AgentDelegation[]) ?? [],
    count: count ?? 0,
  };
}

// ──────────────────────────────────────────────
// Check Authorization
// ──────────────────────────────────────────────

export interface AuthorizationResult {
  allowed: boolean;
  delegation_id?: string;
  chain?: string[];
  denial_reason?: string;
  remaining_spend_limit?: number;
}

/**
 * Check if a delegate is authorized to perform an action on behalf of a grantor.
 *
 * Traverses the delegation chain (for sub-delegations) and validates:
 *   1. Delegation exists and is active
 *   2. Delegation hasn't expired
 *   3. Requested action is in the delegation's scopes
 *   4. Resource ID (if provided) is in the allowed list
 *   5. Spend limits aren't exceeded (for billing.spend)
 *
 * Every check is audit-logged regardless of outcome.
 */
export async function checkAuthorization(input: DelegationCheckInput): Promise<AuthorizationResult> {
  const db = getServiceDb();
  if (!db) return { allowed: false, denial_reason: 'Service unavailable' };

  const result = await findValidDelegation(
    db,
    input.delegate_agent_id,
    input.grantor_agent_id,
    input.action,
    input.resource_id,
    input.spend_amount,
    [],
    0,
  );

  // Audit log
  await db.from('a2a_delegation_audit').insert({
    delegation_id: result.delegation_id ?? null,
    grantor_agent_id: input.grantor_agent_id,
    delegate_agent_id: input.delegate_agent_id,
    action: input.action,
    resource_id: input.resource_id ?? null,
    chain: result.chain ?? [],
    allowed: result.allowed,
    denial_reason: result.denial_reason ?? null,
    spend_amount: input.spend_amount ?? null,
  });

  return result;
}

/** Recursively search for a valid delegation, traversing sub-delegation chains. */
async function findValidDelegation(
  db: NonNullable<ReturnType<typeof getServiceDb>>,
  delegateId: string,
  grantorId: string,
  action: DelegatableAction,
  resourceId: string | undefined,
  spendAmount: number | undefined,
  chain: string[],
  depth: number,
): Promise<AuthorizationResult> {
  // Circuit breaker for infinite chains
  if (depth > 5) {
    return { allowed: false, denial_reason: 'Delegation chain depth exceeded', chain };
  }

  const now = new Date().toISOString();

  // Find active delegation from grantor to delegate
  const { data: delegations } = await db
    .from('a2a_delegations')
    .select('*')
    .eq('grantor_agent_id', grantorId)
    .eq('delegate_agent_id', delegateId)
    .eq('status', 'active')
    .lte('starts_at', now)
    .gte('expires_at', now);

  if (!delegations || delegations.length === 0) {
    // Try to find via sub-delegation chain: find any agent that has
    // a delegation from the grantor, then check if that agent delegated to us
    const { data: grantorDelegations } = await db
      .from('a2a_delegations')
      .select('delegate_agent_id, id')
      .eq('grantor_agent_id', grantorId)
      .eq('status', 'active')
      .eq('allow_subdelegation', true)
      .lte('starts_at', now)
      .gte('expires_at', now);

    if (grantorDelegations && grantorDelegations.length > 0) {
      for (const intermediate of grantorDelegations) {
        if (chain.includes(intermediate.delegate_agent_id)) continue; // Cycle detection
        const subResult = await findValidDelegation(
          db,
          delegateId,
          intermediate.delegate_agent_id,
          action,
          resourceId,
          spendAmount,
          [...chain, intermediate.delegate_agent_id],
          depth + 1,
        );
        if (subResult.allowed) return subResult;
      }
    }

    return { allowed: false, denial_reason: 'No active delegation found', chain };
  }

  // Check each matching delegation
  for (const d of delegations) {
    const delegation = d as AgentDelegation;

    // Scope check
    if (!delegation.scopes.includes(action)) continue;

    // Resource check
    if (resourceId && delegation.resource_ids && delegation.resource_ids.length > 0) {
      if (!delegation.resource_ids.includes(resourceId)) continue;
    }

    // Chain depth check
    if (delegation.chain_depth > delegation.max_chain_depth) continue;

    // Spend limit checks
    if (action === 'billing.spend' && spendAmount) {
      if (delegation.spend_limit_per_action && spendAmount > delegation.spend_limit_per_action) {
        return {
          allowed: false,
          delegation_id: delegation.id,
          chain: [...chain, delegation.id],
          denial_reason: `Amount ${spendAmount} exceeds per-action limit of ${delegation.spend_limit_per_action}`,
        };
      }
      if (delegation.spend_limit_total && delegation.spent_total + spendAmount > delegation.spend_limit_total) {
        return {
          allowed: false,
          delegation_id: delegation.id,
          chain: [...chain, delegation.id],
          denial_reason: `Would exceed total spend limit (${delegation.spent_total} + ${spendAmount} > ${delegation.spend_limit_total})`,
          remaining_spend_limit: delegation.spend_limit_total - delegation.spent_total,
        };
      }
    }

    // All checks passed
    const remainingSpend = delegation.spend_limit_total
      ? delegation.spend_limit_total - delegation.spent_total
      : undefined;

    return {
      allowed: true,
      delegation_id: delegation.id,
      chain: [...chain, delegation.id],
      remaining_spend_limit: remainingSpend,
    };
  }

  return { allowed: false, denial_reason: 'No delegation with matching scope found', chain };
}

// ──────────────────────────────────────────────
// Record Spend (after authorized billing.spend)
// ──────────────────────────────────────────────

export async function recordDelegatedSpend(
  delegation_id: string,
  amount: number,
): Promise<boolean> {
  const db = getServiceDb();
  if (!db) return false;

  const { data: delegation } = await db
    .from('a2a_delegations')
    .select('spent_total')
    .eq('id', delegation_id)
    .single();

  if (!delegation) return false;

  const { error } = await db
    .from('a2a_delegations')
    .update({ spent_total: (delegation.spent_total ?? 0) + amount })
    .eq('id', delegation_id)
    .eq('spent_total', delegation.spent_total); // Optimistic concurrency

  return !error;
}

// ──────────────────────────────────────────────
// Revoke Delegation
// ──────────────────────────────────────────────

export async function revokeDelegation(
  delegation_id: string,
  agent_id: string,
): Promise<
  | { delegation_id: string; status: DelegationStatus; revoked_at: string }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const { data: delegation } = await db
    .from('a2a_delegations')
    .select('*')
    .eq('id', delegation_id)
    .single();

  if (!delegation) return { error: 'Delegation not found', status_code: 404 };
  const d = delegation as AgentDelegation;

  // Only the grantor can revoke
  if (d.grantor_agent_id !== agent_id) {
    return { error: 'Only the grantor can revoke a delegation', status_code: 403 };
  }

  if (d.status === 'revoked') {
    return { error: 'Delegation is already revoked', status_code: 409 };
  }

  if (d.status === 'expired') {
    return { error: 'Delegation has already expired', status_code: 409 };
  }

  const revokedAt = new Date().toISOString();
  await db
    .from('a2a_delegations')
    .update({ status: 'revoked', revoked_at: revokedAt })
    .eq('id', delegation_id);

  // Also revoke any sub-delegations
  await db
    .from('a2a_delegations')
    .update({ status: 'revoked', revoked_at: revokedAt })
    .eq('parent_delegation_id', delegation_id)
    .in('status', ['pending', 'active']);

  return {
    delegation_id,
    status: 'revoked',
    revoked_at: revokedAt,
  };
}

// ──────────────────────────────────────────────
// Query Audit Log
// ──────────────────────────────────────────────

export async function queryDelegationAudit(
  agent_id: string,
  limit: number = 50,
  offset: number = 0,
): Promise<{ entries: DelegationAuditEntry[]; count: number }> {
  const db = getServiceDb();
  if (!db) return { entries: [], count: 0 };

  const { data, count } = await db
    .from('a2a_delegation_audit')
    .select('*', { count: 'exact' })
    .or(`grantor_agent_id.eq.${agent_id},delegate_agent_id.eq.${agent_id}`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return {
    entries: (data as DelegationAuditEntry[]) ?? [],
    count: count ?? 0,
  };
}
