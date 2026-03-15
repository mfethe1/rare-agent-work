/**
 * Agent Service Contract Engine
 *
 * Manages the full contract lifecycle: proposal, negotiation,
 * activation, compliance monitoring, and breach detection.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceDb } from '../auth';
import { DEFAULT_SLA } from './types';
import type {
  ServiceContract,
  ServiceSLA,
  ContractPricing,
  ContractCompliance,
  NegotiationEntry,
  SLAViolation,
  ContractStatus,
} from './types';
import type { ContractProposeInput, ContractNegotiateInput } from './validation';

// ──────────────────────────────────────────────
// Contract Proposal
// ──────────────────────────────────────────────

interface ProposeParams {
  consumer_agent_id: string;
  input: ContractProposeInput;
}

export async function proposeContract({ consumer_agent_id, input }: ProposeParams): Promise<{
  contract_id: string;
  status: ContractStatus;
  created_at: string;
} | null> {
  const db = getServiceDb();
  if (!db) return null;

  // Merge partial SLA with defaults
  const sla: ServiceSLA = { ...DEFAULT_SLA, ...input.sla };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + input.duration_days);

  const { data, error } = await db
    .from('a2a_service_contracts')
    .insert({
      provider_agent_id: input.provider_agent_id,
      consumer_agent_id,
      capabilities: input.capabilities,
      status: 'proposed',
      sla,
      pricing: input.pricing,
      duration_days: input.duration_days,
      expires_at: expiresAt.toISOString(),
      negotiation_rounds: 1,
      max_negotiation_rounds: input.max_negotiation_rounds,
      last_proposed_by: consumer_agent_id,
    })
    .select('id, status, created_at')
    .single();

  if (error || !data) return null;

  // Record the initial proposal in negotiation history
  await db.from('a2a_contract_negotiations').insert({
    contract_id: data.id,
    agent_id: consumer_agent_id,
    action: 'propose',
    proposed_sla: sla,
    proposed_pricing: input.pricing,
    proposed_duration_days: input.duration_days,
    rationale: input.rationale ?? null,
    round: 1,
  });

  return data;
}

// ──────────────────────────────────────────────
// Negotiation
// ──────────────────────────────────────────────

interface NegotiateParams {
  contract_id: string;
  agent_id: string;
  input: ContractNegotiateInput;
}

export async function negotiateContract({ contract_id, agent_id, input }: NegotiateParams): Promise<{
  contract_id: string;
  status: ContractStatus;
  round: number;
  action: string;
  updated_at: string;
} | { error: string; status_code: number }> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  // Fetch contract
  const { data: contract, error: fetchErr } = await db
    .from('a2a_service_contracts')
    .select('*')
    .eq('id', contract_id)
    .single();

  if (fetchErr || !contract) {
    return { error: 'Contract not found', status_code: 404 };
  }

  // Validate the agent is a party to this contract
  const isProvider = contract.provider_agent_id === agent_id;
  const isConsumer = contract.consumer_agent_id === agent_id;
  if (!isProvider && !isConsumer) {
    return { error: 'You are not a party to this contract', status_code: 403 };
  }

  // Validate contract is in a negotiable state
  if (contract.status !== 'proposed' && contract.status !== 'negotiating') {
    return { error: `Contract status "${contract.status}" does not allow negotiation`, status_code: 409 };
  }

  // Validate turn-based negotiation (can't counter your own proposal)
  if (input.action === 'counter' && contract.last_proposed_by === agent_id) {
    return { error: 'Cannot counter your own proposal. Wait for the other party.', status_code: 409 };
  }

  // Check max negotiation rounds
  if (input.action === 'counter' && contract.negotiation_rounds >= contract.max_negotiation_rounds) {
    // Auto-reject: too many rounds
    await db
      .from('a2a_service_contracts')
      .update({
        status: 'terminated',
        termination_reason: `Negotiation exceeded ${contract.max_negotiation_rounds} rounds`,
      })
      .eq('id', contract_id);

    return {
      contract_id,
      status: 'terminated',
      round: contract.negotiation_rounds,
      action: 'reject',
      updated_at: new Date().toISOString(),
    };
  }

  const newRound = contract.negotiation_rounds + 1;

  // Handle each action
  if (input.action === 'accept') {
    return await acceptContract(db, contract, agent_id, newRound, input.rationale);
  }

  if (input.action === 'reject') {
    return await rejectContract(db, contract, agent_id, newRound, input.rationale);
  }

  // Counter-proposal
  const mergedSla = { ...contract.sla, ...input.proposed_sla };
  const mergedPricing = { ...contract.pricing, ...input.proposed_pricing };
  const mergedDuration = input.proposed_duration_days ?? contract.duration_days;

  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + mergedDuration);

  // Update contract with counter-proposal
  const { data: updated, error: updateErr } = await db
    .from('a2a_service_contracts')
    .update({
      status: 'negotiating',
      sla: mergedSla,
      pricing: mergedPricing,
      duration_days: mergedDuration,
      expires_at: newExpiry.toISOString(),
      negotiation_rounds: newRound,
      last_proposed_by: agent_id,
    })
    .eq('id', contract_id)
    .select('updated_at')
    .single();

  if (updateErr || !updated) {
    return { error: 'Failed to update contract', status_code: 500 };
  }

  // Record negotiation entry
  await db.from('a2a_contract_negotiations').insert({
    contract_id,
    agent_id,
    action: 'counter',
    proposed_sla: input.proposed_sla ?? null,
    proposed_pricing: input.proposed_pricing ?? null,
    proposed_duration_days: input.proposed_duration_days ?? null,
    rationale: input.rationale ?? null,
    round: newRound,
  });

  return {
    contract_id,
    status: 'negotiating' as ContractStatus,
    round: newRound,
    action: 'counter',
    updated_at: updated.updated_at,
  };
}

async function acceptContract(
  db: SupabaseClient,
  contract: Record<string, unknown>,
  agent_id: string,
  round: number,
  rationale?: string,
) {
  const contract_id = contract.id as string;
  const startsAt = new Date().toISOString();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (contract.duration_days as number));

  const { data: updated, error } = await db
    .from('a2a_service_contracts')
    .update({
      status: 'active',
      starts_at: startsAt,
      expires_at: expiresAt.toISOString(),
      negotiation_rounds: round,
    })
    .eq('id', contract_id)
    .select('updated_at')
    .single();

  if (error || !updated) {
    return { error: 'Failed to activate contract', status_code: 500 };
  }

  await db.from('a2a_contract_negotiations').insert({
    contract_id,
    agent_id,
    action: 'accept',
    rationale: rationale ?? null,
    round,
  });

  return {
    contract_id,
    status: 'active' as ContractStatus,
    round,
    action: 'accept',
    updated_at: updated.updated_at,
  };
}

async function rejectContract(
  db: SupabaseClient,
  contract: Record<string, unknown>,
  agent_id: string,
  round: number,
  rationale?: string,
) {
  const contract_id = contract.id as string;

  const { data: updated, error } = await db
    .from('a2a_service_contracts')
    .update({
      status: 'terminated',
      termination_reason: rationale ?? 'Rejected by counterparty',
      negotiation_rounds: round,
    })
    .eq('id', contract_id)
    .select('updated_at')
    .single();

  if (error || !updated) {
    return { error: 'Failed to reject contract', status_code: 500 };
  }

  await db.from('a2a_contract_negotiations').insert({
    contract_id,
    agent_id,
    action: 'reject',
    rationale: rationale ?? null,
    round,
  });

  return {
    contract_id,
    status: 'terminated' as ContractStatus,
    round,
    action: 'reject',
    updated_at: updated.updated_at,
  };
}

// ──────────────────────────────────────────────
// Compliance Monitoring & Breach Detection
// ──────────────────────────────────────────────

/**
 * Check compliance for a given active contract by analyzing tasks
 * completed under it. Records violations and triggers breach status
 * if critical thresholds are exceeded.
 */
export async function checkCompliance(contract_id: string): Promise<ContractCompliance | null> {
  const db = getServiceDb();
  if (!db) return null;

  // Fetch contract
  const { data: contract } = await db
    .from('a2a_service_contracts')
    .select('*')
    .eq('id', contract_id)
    .eq('status', 'active')
    .single();

  if (!contract) return null;

  const sla = contract.sla as ServiceSLA;

  // Fetch all tasks between provider and consumer during contract period
  const { data: tasks } = await db
    .from('a2a_tasks')
    .select('id, status, created_at, completed_at, result, error')
    .eq('sender_agent_id', contract.consumer_agent_id)
    .eq('target_agent_id', contract.provider_agent_id)
    .gte('created_at', contract.starts_at)
    .in('status', ['completed', 'failed']);

  if (!tasks || tasks.length === 0) {
    return {
      tasks_completed: 0,
      tasks_failed: 0,
      avg_latency_ms: 0,
      p95_latency_ms: 0,
      avg_quality_rating: 0,
      failure_rate_percent: 0,
      violations_count: 0,
      is_compliant: true,
      last_checked_at: new Date().toISOString(),
    };
  }

  const completed = tasks.filter((t) => t.status === 'completed');
  const failed = tasks.filter((t) => t.status === 'failed');

  // Calculate latencies
  const latencies = completed
    .filter((t) => t.completed_at)
    .map((t) => new Date(t.completed_at).getTime() - new Date(t.created_at).getTime())
    .sort((a, b) => a - b);

  const avgLatency = latencies.length > 0
    ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
    : 0;
  const p95Latency = latencies.length > 0
    ? latencies[Math.floor(latencies.length * 0.95)] ?? latencies[latencies.length - 1]
    : 0;

  const failureRate = tasks.length > 0 ? (failed.length / tasks.length) * 100 : 0;

  // Fetch quality ratings for tasks under this contract
  const taskIds = completed.map((t) => t.id);
  let avgQuality = 0;
  if (taskIds.length > 0) {
    const { data: feedback } = await db
      .from('a2a_task_feedback')
      .select('rating')
      .in('task_id', taskIds);

    if (feedback && feedback.length > 0) {
      avgQuality = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
    }
  }

  // Detect violations
  const violations: Array<Omit<SLAViolation, 'id' | 'created_at'>> = [];

  if (avgLatency > sla.max_latency_ms) {
    violations.push({
      contract_id,
      metric: 'latency',
      threshold_value: sla.max_latency_ms,
      actual_value: Math.round(avgLatency),
      severity: avgLatency > sla.max_latency_ms * 2 ? 'critical' : 'warning',
    });
  }

  if (failureRate > sla.max_failure_rate_percent) {
    violations.push({
      contract_id,
      metric: 'failure_rate',
      threshold_value: sla.max_failure_rate_percent,
      actual_value: Math.round(failureRate * 100) / 100,
      severity: failureRate > sla.max_failure_rate_percent * 2 ? 'critical' : 'warning',
    });
  }

  if (avgQuality > 0 && avgQuality < sla.min_quality_rating) {
    violations.push({
      contract_id,
      metric: 'quality',
      threshold_value: sla.min_quality_rating,
      actual_value: Math.round(avgQuality * 100) / 100,
      severity: avgQuality < sla.min_quality_rating - 1 ? 'critical' : 'warning',
    });
  }

  // Record violations
  if (violations.length > 0) {
    await db.from('a2a_sla_violations').insert(violations);
  }

  // Check for breach condition: 3+ critical violations = auto-breach
  const { count: criticalCount } = await db
    .from('a2a_sla_violations')
    .select('id', { count: 'exact', head: true })
    .eq('contract_id', contract_id)
    .eq('severity', 'critical');

  const isBreached = (criticalCount ?? 0) >= 3;
  const isCompliant = violations.length === 0;

  // Fetch total violation count
  const { count: totalViolations } = await db
    .from('a2a_sla_violations')
    .select('id', { count: 'exact', head: true })
    .eq('contract_id', contract_id);

  const compliance: ContractCompliance = {
    tasks_completed: completed.length,
    tasks_failed: failed.length,
    avg_latency_ms: Math.round(avgLatency),
    p95_latency_ms: Math.round(p95Latency),
    avg_quality_rating: Math.round(avgQuality * 100) / 100,
    failure_rate_percent: Math.round(failureRate * 100) / 100,
    violations_count: totalViolations ?? 0,
    is_compliant: isCompliant,
    last_checked_at: new Date().toISOString(),
  };

  // Update contract compliance snapshot
  await db
    .from('a2a_service_contracts')
    .update({
      compliance,
      ...(isBreached ? {
        status: 'breached',
        termination_reason: `Auto-breached: ${criticalCount} critical SLA violations`,
      } : {}),
    })
    .eq('id', contract_id);

  return compliance;
}

// ──────────────────────────────────────────────
// Contract Queries
// ──────────────────────────────────────────────

interface ListParams {
  agent_id: string;
  status?: ContractStatus;
  role?: 'provider' | 'consumer' | 'any';
  capability?: string;
  limit?: number;
}

export async function listContracts({ agent_id, status, role = 'any', capability, limit = 50 }: ListParams): Promise<ServiceContract[]> {
  const db = getServiceDb();
  if (!db) return [];

  let query = db.from('a2a_service_contracts').select('*');

  // Filter by role
  if (role === 'provider') {
    query = query.eq('provider_agent_id', agent_id);
  } else if (role === 'consumer') {
    query = query.eq('consumer_agent_id', agent_id);
  } else {
    query = query.or(`provider_agent_id.eq.${agent_id},consumer_agent_id.eq.${agent_id}`);
  }

  if (status) query = query.eq('status', status);
  if (capability) query = query.contains('capabilities', [capability]);

  const { data } = await query
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data as ServiceContract[]) ?? [];
}

export async function getContractDetail(contract_id: string, agent_id: string) {
  const db = getServiceDb();
  if (!db) return null;

  const { data: contract } = await db
    .from('a2a_service_contracts')
    .select('*')
    .eq('id', contract_id)
    .or(`provider_agent_id.eq.${agent_id},consumer_agent_id.eq.${agent_id}`)
    .single();

  if (!contract) return null;

  const { data: negotiations } = await db
    .from('a2a_contract_negotiations')
    .select('*')
    .eq('contract_id', contract_id)
    .order('round', { ascending: true });

  const { data: violations } = await db
    .from('a2a_sla_violations')
    .select('*')
    .eq('contract_id', contract_id)
    .order('created_at', { ascending: false })
    .limit(50);

  return {
    contract: contract as ServiceContract,
    negotiations: (negotiations as NegotiationEntry[]) ?? [],
    violations: (violations as SLAViolation[]) ?? [],
  };
}

/** Terminate an active contract early. */
export async function terminateContract(
  contract_id: string,
  agent_id: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const db = getServiceDb();
  if (!db) return { success: false, error: 'Service unavailable' };

  const { data: contract } = await db
    .from('a2a_service_contracts')
    .select('id, status, provider_agent_id, consumer_agent_id')
    .eq('id', contract_id)
    .or(`provider_agent_id.eq.${agent_id},consumer_agent_id.eq.${agent_id}`)
    .single();

  if (!contract) return { success: false, error: 'Contract not found' };
  if (contract.status !== 'active' && contract.status !== 'negotiating' && contract.status !== 'proposed') {
    return { success: false, error: `Cannot terminate a ${contract.status} contract` };
  }

  const { error } = await db
    .from('a2a_service_contracts')
    .update({
      status: 'terminated',
      termination_reason: reason,
    })
    .eq('id', contract_id);

  if (error) return { success: false, error: 'Failed to terminate contract' };
  return { success: true };
}

/**
 * Find active contract between two agents for a given capability.
 * Used by task submission to enforce contract-based routing.
 */
export async function findActiveContract(
  consumer_id: string,
  provider_id: string,
  capability: string,
): Promise<ServiceContract | null> {
  const db = getServiceDb();
  if (!db) return null;

  const { data } = await db
    .from('a2a_service_contracts')
    .select('*')
    .eq('consumer_agent_id', consumer_id)
    .eq('provider_agent_id', provider_id)
    .eq('status', 'active')
    .contains('capabilities', [capability])
    .lte('starts_at', new Date().toISOString())
    .gte('expires_at', new Date().toISOString())
    .limit(1)
    .single();

  return (data as ServiceContract) ?? null;
}
