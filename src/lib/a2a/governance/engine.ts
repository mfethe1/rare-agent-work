/**
 * Agent Governance Engine
 *
 * Core logic for policy evaluation, escalation management,
 * audit logging, and kill switch enforcement.
 *
 * Evaluation order:
 *   1. Check agent suspension (kill switch) → deny if suspended
 *   2. Fetch active policies sorted by priority (highest first)
 *   3. For each policy, evaluate constraints:
 *      a. Autonomy level check
 *      b. Action whitelist/blacklist
 *      c. Intent whitelist/blacklist
 *      d. Target whitelist/blacklist
 *      e. Time window check
 *      f. Spend limit check
 *   4. First policy to produce a definitive result wins
 *   5. No matching policy → default deny (fail-closed)
 *   6. Log audit entry for every evaluation
 */

import { getServiceDb } from '../auth';
import { AUTONOMY_RANK } from './types';
import type {
  GovernancePolicy,
  PolicyEvaluation,
  PolicyDecision,
  EscalationRequest,
  GovernanceAuditEntry,
  AgentSuspension,
  AutonomyLevel,
  GovernedAction,
  TimeWindow,
} from './types';
import type {
  PolicyCreateInput,
  EvaluateActionInput,
  EscalationResolveInput,
  KillSwitchInput,
  KillSwitchLiftInput,
} from './validation';

// ──────────────────────────────────────────────
// Policy Management
// ──────────────────────────────────────────────

export async function createPolicy(
  creator_agent_id: string,
  input: PolicyCreateInput,
): Promise<{ policy_id: string; created_at: string } | null> {
  const db = getServiceDb();
  if (!db) return null;

  const { data, error } = await db
    .from('a2a_governance_policies')
    .insert({
      name: input.name,
      description: input.description,
      agent_id: input.agent_id,
      autonomy_level: input.autonomy_level,
      allowed_actions: input.allowed_actions,
      denied_actions: input.denied_actions,
      allowed_intents: input.allowed_intents,
      denied_intents: input.denied_intents,
      allowed_targets: input.allowed_targets,
      denied_targets: input.denied_targets,
      spend_limit: input.spend_limit ?? null,
      time_windows: input.time_windows,
      escalation_target_id: input.escalation_target_id,
      priority: input.priority,
      is_active: true,
      created_by: creator_agent_id,
    })
    .select('id, created_at')
    .single();

  if (error || !data) return null;
  return { policy_id: data.id, created_at: data.created_at };
}

export async function listPolicies(params: {
  agent_id?: string;
  is_active?: boolean;
  limit?: number;
}): Promise<GovernancePolicy[]> {
  const db = getServiceDb();
  if (!db) return [];

  let query = db.from('a2a_governance_policies').select('*');

  if (params.agent_id) query = query.eq('agent_id', params.agent_id);
  if (params.is_active !== undefined) query = query.eq('is_active', params.is_active);

  const { data } = await query
    .order('priority', { ascending: false })
    .limit(params.limit ?? 50);

  return (data as GovernancePolicy[]) ?? [];
}

export async function deactivatePolicy(policy_id: string): Promise<boolean> {
  const db = getServiceDb();
  if (!db) return false;

  const { error } = await db
    .from('a2a_governance_policies')
    .update({ is_active: false })
    .eq('id', policy_id);

  return !error;
}

// ──────────────────────────────────────────────
// Policy Evaluation Engine
// ──────────────────────────────────────────────

/** Minimum autonomy level required per action type. */
const ACTION_AUTONOMY_REQUIREMENTS: Record<GovernedAction, AutonomyLevel> = {
  'task.submit': 'act_with_approval',
  'task.update': 'act_with_approval',
  'context.store': 'suggest',
  'context.delete': 'act_with_approval',
  'channel.create': 'suggest',
  'channel.message': 'suggest',
  'workflow.trigger': 'act_with_approval',
  'contract.propose': 'act_with_approval',
  'contract.negotiate': 'act_with_approval',
  'contract.terminate': 'autonomous',
  'agent.register': 'suggest',
};

export async function evaluateAction(
  agent_id: string,
  input: EvaluateActionInput,
): Promise<{
  evaluation: PolicyEvaluation;
  escalation_id?: string;
  audit_id: string;
} | null> {
  const db = getServiceDb();
  if (!db) return null;

  // Step 1: Check kill switch
  const { data: suspension } = await db
    .from('a2a_agent_suspensions')
    .select('id')
    .eq('agent_id', agent_id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (suspension) {
    const evaluation: PolicyEvaluation = {
      decision: 'deny',
      policy_id: 'system:kill-switch',
      policy_name: 'Kill Switch',
      reason: 'Agent is currently suspended',
      autonomy_level: 'observe',
    };
    const audit_id = await logAudit(db, agent_id, input, evaluation);
    return { evaluation, audit_id: audit_id ?? '' };
  }

  // Step 2: Fetch active policies for this agent, sorted by priority
  const { data: policies } = await db
    .from('a2a_governance_policies')
    .select('*')
    .eq('agent_id', agent_id)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (!policies || policies.length === 0) {
    // No policies = default deny (fail-closed)
    const evaluation: PolicyEvaluation = {
      decision: 'deny',
      policy_id: 'system:no-policy',
      policy_name: 'Default Deny',
      reason: 'No governance policy found for this agent. Register a policy before taking actions.',
      autonomy_level: 'observe',
    };
    const audit_id = await logAudit(db, agent_id, input, evaluation);
    return { evaluation, audit_id: audit_id ?? '' };
  }

  // Step 3: Evaluate each policy (first match wins)
  for (const policy of policies as GovernancePolicy[]) {
    const result = evaluateAgainstPolicy(policy, input);
    if (result) {
      // Log audit
      const audit_id = await logAudit(db, agent_id, input, result);

      // Create escalation if needed
      let escalation_id: string | undefined;
      if (result.decision === 'escalate') {
        escalation_id = await createEscalation(db, agent_id, input, policy, result.reason);
      }

      return { evaluation: result, escalation_id, audit_id: audit_id ?? '' };
    }
  }

  // No policy matched (all were inconclusive) — default deny
  const evaluation: PolicyEvaluation = {
    decision: 'deny',
    policy_id: 'system:no-match',
    policy_name: 'Default Deny',
    reason: 'No policy produced a definitive result for this action.',
    autonomy_level: 'observe',
  };
  const audit_id = await logAudit(db, agent_id, input, evaluation);
  return { evaluation, audit_id: audit_id ?? '' };
}

/**
 * Evaluate a single action against a single policy.
 * Returns null if this policy is not applicable (doesn't match).
 */
export function evaluateAgainstPolicy(
  policy: GovernancePolicy,
  input: EvaluateActionInput,
): PolicyEvaluation | null {
  const base = {
    policy_id: policy.id,
    policy_name: policy.name,
    autonomy_level: policy.autonomy_level,
    escalation_target_id: policy.escalation_target_id,
  };

  // Check denied actions (blacklist, highest priority)
  if (policy.denied_actions.length > 0 && policy.denied_actions.includes(input.action)) {
    return { ...base, decision: 'deny', reason: `Action "${input.action}" is explicitly denied by policy "${policy.name}"` };
  }

  // Check allowed actions (whitelist)
  if (policy.allowed_actions.length > 0 && !policy.allowed_actions.includes(input.action)) {
    return { ...base, decision: 'deny', reason: `Action "${input.action}" is not in the allowed actions list for policy "${policy.name}"` };
  }

  // Check denied intents
  if (input.intent && policy.denied_intents.length > 0) {
    if (matchesGlobList(input.intent, policy.denied_intents)) {
      return { ...base, decision: 'deny', reason: `Intent "${input.intent}" is denied by policy "${policy.name}"` };
    }
  }

  // Check allowed intents
  if (input.intent && policy.allowed_intents.length > 0) {
    if (!matchesGlobList(input.intent, policy.allowed_intents)) {
      return { ...base, decision: 'deny', reason: `Intent "${input.intent}" is not in the allowed intents for policy "${policy.name}"` };
    }
  }

  // Check denied targets
  if (input.target_agent_id && policy.denied_targets.length > 0) {
    if (policy.denied_targets.includes(input.target_agent_id)) {
      return { ...base, decision: 'deny', reason: `Target agent is in the denied targets list for policy "${policy.name}"` };
    }
  }

  // Check allowed targets
  if (input.target_agent_id && policy.allowed_targets.length > 0) {
    if (!policy.allowed_targets.includes(input.target_agent_id)) {
      return { ...base, decision: 'deny', reason: `Target agent is not in the allowed targets list for policy "${policy.name}"` };
    }
  }

  // Check time windows
  if (policy.time_windows.length > 0) {
    if (!isWithinTimeWindows(policy.time_windows)) {
      return { ...base, decision: 'deny', reason: `Action attempted outside permitted time windows for policy "${policy.name}"` };
    }
  }

  // Check spend limits
  if (policy.spend_limit && input.estimated_cost !== undefined) {
    if (input.estimated_cost > policy.spend_limit.max_per_action_spend) {
      return {
        ...base,
        decision: 'escalate',
        reason: `Estimated cost (${input.estimated_cost}) exceeds per-action limit (${policy.spend_limit.max_per_action_spend})`,
      };
    }
  }

  // Check autonomy level requirement
  const requiredLevel = ACTION_AUTONOMY_REQUIREMENTS[input.action];
  const agentRank = AUTONOMY_RANK[policy.autonomy_level];
  const requiredRank = AUTONOMY_RANK[requiredLevel];

  if (agentRank < requiredRank) {
    // Not enough autonomy — escalate if act_with_approval, deny if lower
    if (policy.autonomy_level === 'suggest') {
      return {
        ...base,
        decision: 'escalate',
        reason: `Autonomy level "${policy.autonomy_level}" requires escalation for "${input.action}" (needs "${requiredLevel}")`,
      };
    }
    return {
      ...base,
      decision: 'deny',
      reason: `Autonomy level "${policy.autonomy_level}" insufficient for "${input.action}" (needs "${requiredLevel}")`,
    };
  }

  // All checks passed
  return { ...base, decision: 'allow', reason: `Action permitted by policy "${policy.name}" at autonomy level "${policy.autonomy_level}"` };
}

// ──────────────────────────────────────────────
// Glob Pattern Matching
// ──────────────────────────────────────────────

/** Check if a string matches any glob-style pattern in the list. */
export function matchesGlobList(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchGlob(value, pattern));
}

/** Simple glob matching: supports * (any chars) and ? (single char). */
export function matchGlob(value: string, pattern: string): boolean {
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$',
  );
  return regex.test(value);
}

// ──────────────────────────────────────────────
// Time Window Checking
// ──────────────────────────────────────────────

export function isWithinTimeWindows(windows: TimeWindow[], now?: Date): boolean {
  const d = now ?? new Date();
  const day = d.getUTCDay();
  const hour = d.getUTCHours();

  return windows.some((w) => {
    const dayOk = w.days_of_week.length === 0 || w.days_of_week.includes(day);
    const hourOk =
      w.start_hour_utc <= w.end_hour_utc
        ? hour >= w.start_hour_utc && hour < w.end_hour_utc
        : hour >= w.start_hour_utc || hour < w.end_hour_utc; // wraps midnight
    return dayOk && hourOk;
  });
}

// ──────────────────────────────────────────────
// Escalation Management
// ──────────────────────────────────────────────

async function createEscalation(
  db: ReturnType<typeof getServiceDb>,
  agent_id: string,
  input: EvaluateActionInput,
  policy: GovernancePolicy,
  reason: string,
): Promise<string | undefined> {
  if (!db) return undefined;

  const ttlSeconds = 3600; // 1 hour default
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const { data } = await db
    .from('a2a_governance_escalations')
    .insert({
      agent_id,
      action: input.action,
      intent: input.intent ?? null,
      target_agent_id: input.target_agent_id ?? null,
      escalation_target_id: policy.escalation_target_id,
      policy_id: policy.id,
      status: 'pending',
      reason,
      metadata: input.metadata ?? null,
      ttl_seconds: ttlSeconds,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  return data?.id;
}

export async function resolveEscalation(
  resolver_agent_id: string,
  escalation_id: string,
  input: EscalationResolveInput,
): Promise<{ escalation_id: string; status: string; resolved_at: string } | { error: string; status_code: number }> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const { data: escalation } = await db
    .from('a2a_governance_escalations')
    .select('*')
    .eq('id', escalation_id)
    .single();

  if (!escalation) return { error: 'Escalation not found', status_code: 404 };
  if (escalation.status !== 'pending') {
    return { error: `Escalation already ${escalation.status}`, status_code: 409 };
  }
  if (escalation.escalation_target_id !== resolver_agent_id) {
    return { error: 'You are not the designated escalation target', status_code: 403 };
  }

  const resolvedAt = new Date().toISOString();
  const newStatus = input.decision === 'approved' ? 'approved' : 'denied';

  const { error } = await db
    .from('a2a_governance_escalations')
    .update({
      status: newStatus,
      reviewer_rationale: input.rationale ?? null,
      resolved_at: resolvedAt,
    })
    .eq('id', escalation_id);

  if (error) return { error: 'Failed to resolve escalation', status_code: 500 };

  // Log audit for the resolution
  await db.from('a2a_governance_audit').insert({
    agent_id: escalation.agent_id,
    action: escalation.action,
    decision: newStatus === 'approved' ? 'allow' : 'deny',
    policy_id: escalation.policy_id,
    escalation_id,
    intent: escalation.intent,
    target_agent_id: escalation.target_agent_id,
    reason: `Escalation ${newStatus} by ${resolver_agent_id}: ${input.rationale ?? 'no rationale'}`,
    metadata: { resolver: resolver_agent_id },
  });

  return { escalation_id, status: newStatus, resolved_at: resolvedAt };
}

export async function listEscalations(
  agent_id: string,
  params: { status?: string; limit?: number },
): Promise<EscalationRequest[]> {
  const db = getServiceDb();
  if (!db) return [];

  let query = db
    .from('a2a_governance_escalations')
    .select('*')
    .eq('escalation_target_id', agent_id);

  if (params.status) query = query.eq('status', params.status);

  const { data } = await query
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 50);

  return (data as EscalationRequest[]) ?? [];
}

// ──────────────────────────────────────────────
// Audit Logging
// ──────────────────────────────────────────────

async function logAudit(
  db: ReturnType<typeof getServiceDb>,
  agent_id: string,
  input: EvaluateActionInput,
  evaluation: PolicyEvaluation,
): Promise<string | null> {
  if (!db) return null;

  const { data } = await db
    .from('a2a_governance_audit')
    .insert({
      agent_id,
      action: input.action,
      decision: evaluation.decision,
      policy_id: evaluation.policy_id,
      intent: input.intent ?? null,
      target_agent_id: input.target_agent_id ?? null,
      reason: evaluation.reason,
      metadata: input.metadata ?? null,
    })
    .select('id')
    .single();

  return data?.id ?? null;
}

export async function queryAuditLog(params: {
  agent_id?: string;
  action?: string;
  decision?: string;
  limit?: number;
}): Promise<GovernanceAuditEntry[]> {
  const db = getServiceDb();
  if (!db) return [];

  let query = db.from('a2a_governance_audit').select('*');

  if (params.agent_id) query = query.eq('agent_id', params.agent_id);
  if (params.action) query = query.eq('action', params.action);
  if (params.decision) query = query.eq('decision', params.decision);

  const { data } = await query
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 100);

  return (data as GovernanceAuditEntry[]) ?? [];
}

// ──────────────────────────────────────────────
// Kill Switch
// ──────────────────────────────────────────────

export async function activateKillSwitch(
  suspended_by: string,
  input: KillSwitchInput,
): Promise<AgentSuspension | null> {
  const db = getServiceDb();
  if (!db) return null;

  // 1. Deactivate the agent
  await db
    .from('agent_registry')
    .update({ is_active: false })
    .eq('id', input.agent_id);

  // 2. Cancel active tasks
  const { count: tasksCancelled } = await db
    .from('a2a_tasks')
    .update({ status: 'failed', error: { code: 'AGENT_SUSPENDED', message: input.reason } })
    .eq('sender_agent_id', input.agent_id)
    .in('status', ['submitted', 'accepted', 'in_progress'])
    .select('id', { count: 'exact', head: true });

  // Also cancel tasks targeted to this agent
  const { count: tasksTargetCancelled } = await db
    .from('a2a_tasks')
    .update({ status: 'failed', error: { code: 'AGENT_SUSPENDED', message: input.reason } })
    .eq('target_agent_id', input.agent_id)
    .in('status', ['submitted', 'accepted', 'in_progress'])
    .select('id', { count: 'exact', head: true });

  // 3. Freeze active contracts
  const { count: contractsFrozen } = await db
    .from('a2a_service_contracts')
    .update({ status: 'terminated', termination_reason: `Agent suspended: ${input.reason}` })
    .or(`provider_agent_id.eq.${input.agent_id},consumer_agent_id.eq.${input.agent_id}`)
    .eq('status', 'active')
    .select('id', { count: 'exact', head: true });

  // 4. Record the suspension
  const totalTasks = (tasksCancelled ?? 0) + (tasksTargetCancelled ?? 0);

  const { data: suspension } = await db
    .from('a2a_agent_suspensions')
    .insert({
      agent_id: input.agent_id,
      suspended_by,
      reason: input.reason,
      status: 'active',
      tasks_cancelled: totalTasks,
      workflows_paused: 0, // workflows don't have a direct pause mechanism yet
      contracts_frozen: contractsFrozen ?? 0,
    })
    .select('*')
    .single();

  if (!suspension) return null;

  // 5. Log audit
  await db.from('a2a_governance_audit').insert({
    agent_id: input.agent_id,
    action: 'task.submit', // system action
    decision: 'deny',
    policy_id: 'system:kill-switch',
    reason: `Kill switch activated by ${suspended_by}: ${input.reason}`,
    metadata: {
      suspension_id: suspension.id,
      tasks_cancelled: totalTasks,
      contracts_frozen: contractsFrozen ?? 0,
    },
  });

  return suspension as AgentSuspension;
}

export async function liftKillSwitch(
  lifted_by: string,
  suspension_id: string,
  input: KillSwitchLiftInput,
): Promise<{ success: boolean; error?: string }> {
  const db = getServiceDb();
  if (!db) return { success: false, error: 'Service unavailable' };

  const { data: suspension } = await db
    .from('a2a_agent_suspensions')
    .select('*')
    .eq('id', suspension_id)
    .eq('status', 'active')
    .single();

  if (!suspension) return { success: false, error: 'Active suspension not found' };

  // Lift the suspension
  const { error: updateErr } = await db
    .from('a2a_agent_suspensions')
    .update({
      status: 'lifted',
      lifted_at: new Date().toISOString(),
      lifted_by,
      lift_reason: input.reason,
    })
    .eq('id', suspension_id);

  if (updateErr) return { success: false, error: 'Failed to lift suspension' };

  // Reactivate the agent
  await db
    .from('agent_registry')
    .update({ is_active: true })
    .eq('id', suspension.agent_id);

  // Log audit
  await db.from('a2a_governance_audit').insert({
    agent_id: suspension.agent_id,
    action: 'task.submit',
    decision: 'allow',
    policy_id: 'system:kill-switch',
    reason: `Kill switch lifted by ${lifted_by}: ${input.reason}`,
    metadata: { suspension_id },
  });

  return { success: true };
}
