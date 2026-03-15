/**
 * Agent Arbitration & Dispute Resolution Engine
 *
 * Core logic for the dispute lifecycle: filing, evidence collection,
 * negotiation, escalation, arbitrator assignment, ruling, enforcement,
 * and precedent management.
 *
 * Integration points:
 *   - Billing: filing bonds, refunds, penalties (via billing/engine)
 *   - Reputation: reputation adjustments post-ruling
 *   - Contracts: contract termination/modification enforcement
 *   - Governance: agent suspensions via kill switch
 *   - Identity: evidence content hashing for tamper detection
 */

import { getServiceDb } from '../auth';
import {
  type Dispute,
  type DisputeEvidence,
  type DisputeMessage,
  type DisputeRuling,
  type DisputePrecedent,
  type DisputePhase,
  type DisputeCategory,
  type DisputeSeverity,
  type RulingOutcome,
  type EnforcementDirective,
  type EnforcementAction,
  type ArbitratorQualification,
  type SettlementOffer,
  type NegotiationMessageType,
  type EvidenceType,
  DISPUTE_CONFIG,
  ACTIVE_PHASES,
  SEVERITY_THRESHOLDS,
} from './types';

// ──────────────────────────────────────────────
// Filing Bond Calculation
// ──────────────────────────────────────────────

/**
 * Calculate the filing bond for a dispute.
 * Bond = percentage of disputed amount, clamped to min/max bounds.
 * Purpose: discourage frivolous claims while keeping access fair.
 */
export function calculateFilingBond(amountDisputed: number): number {
  const bond = amountDisputed * (DISPUTE_CONFIG.filing_bond_percent / 100);
  return Math.max(
    DISPUTE_CONFIG.min_filing_bond,
    Math.min(DISPUTE_CONFIG.max_filing_bond, Math.round(bond * 100) / 100),
  );
}

/**
 * Determine severity based on disputed amount and category.
 */
export function assessSeverity(
  amountDisputed: number,
  category: DisputeCategory,
): DisputeSeverity {
  // Identity fraud and data misuse are always critical
  if (category === 'identity_fraud' || category === 'data_misuse') {
    return 'critical';
  }

  if (amountDisputed >= SEVERITY_THRESHOLDS.critical) return 'critical';
  if (amountDisputed >= SEVERITY_THRESHOLDS.high) return 'high';
  if (amountDisputed >= SEVERITY_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Compute a SHA-256 hash of evidence content for tamper detection.
 */
async function hashContent(content: Record<string, unknown>): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(content, Object.keys(content).sort()));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate phase deadline from now.
 */
function phaseDeadline(timeoutHours: number): string {
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + timeoutHours);
  return deadline.toISOString();
}

// ──────────────────────────────────────────────
// Dispute Filing
// ──────────────────────────────────────────────

export interface FileDisputeParams {
  claimant_agent_id: string;
  respondent_agent_id: string;
  category: DisputeCategory;
  title: string;
  description: string;
  contract_id?: string;
  task_ids?: string[];
  amount_disputed: number;
  currency?: string;
}

export interface FileDisputeResult {
  success: boolean;
  dispute_id?: string;
  filing_bond?: number;
  phase_deadline?: string;
  error?: string;
}

/**
 * File a new dispute.
 *
 * Validates:
 * - Both agents exist
 * - Claimant hasn't exceeded max active disputes
 * - Claimant isn't disputing themselves
 * - Calculates filing bond and severity
 * - Creates dispute in 'filed' phase, then auto-advances to 'negotiation'
 */
export async function fileDispute(params: FileDisputeParams): Promise<FileDisputeResult> {
  const db = getServiceDb();
  if (!db) return { success: false, error: 'Service unavailable.' };

  const {
    claimant_agent_id,
    respondent_agent_id,
    category,
    title,
    description,
    contract_id,
    task_ids = [],
    amount_disputed,
    currency = 'credits',
  } = params;

  // Self-dispute check
  if (claimant_agent_id === respondent_agent_id) {
    return { success: false, error: 'Cannot file a dispute against yourself.' };
  }

  // Verify both agents exist
  const { data: agents, error: agentErr } = await db
    .from('a2a_agents')
    .select('id')
    .in('id', [claimant_agent_id, respondent_agent_id]);

  if (agentErr || !agents || agents.length < 2) {
    return { success: false, error: 'One or both agents not found.' };
  }

  // Check active dispute limit
  const { count, error: countErr } = await db
    .from('a2a_disputes')
    .select('id', { count: 'exact', head: true })
    .eq('claimant_agent_id', claimant_agent_id)
    .in('phase', ACTIVE_PHASES);

  if (countErr) {
    return { success: false, error: 'Failed to check active disputes.' };
  }

  if ((count ?? 0) >= DISPUTE_CONFIG.max_active_disputes_per_agent) {
    return { success: false, error: `Maximum ${DISPUTE_CONFIG.max_active_disputes_per_agent} active disputes per agent.` };
  }

  const severity = assessSeverity(amount_disputed, category);
  const filingBond = calculateFilingBond(amount_disputed);
  const timeoutHours = severity === 'critical'
    ? DISPUTE_CONFIG.default_phase_timeout_hours / 2
    : DISPUTE_CONFIG.default_phase_timeout_hours;
  const deadline = phaseDeadline(timeoutHours);

  const { data: dispute, error: insertErr } = await db
    .from('a2a_disputes')
    .insert({
      claimant_agent_id,
      respondent_agent_id,
      category,
      severity,
      phase: 'negotiation', // Skip 'filed', go straight to negotiation
      title,
      description,
      contract_id: contract_id ?? null,
      task_ids,
      amount_disputed,
      currency,
      filing_bond: filingBond,
      phase_timeout_hours: timeoutHours,
      phase_deadline: deadline,
      negotiation_rounds: 0,
      max_negotiation_rounds: DISPUTE_CONFIG.default_max_negotiation_rounds,
      has_been_appealed: false,
      precedent_ids: [],
    })
    .select('id')
    .single();

  if (insertErr || !dispute) {
    console.error('[Arbitration] Failed to file dispute:', insertErr);
    return { success: false, error: 'Failed to file dispute.' };
  }

  // Auto-collect platform evidence (task records, contract snapshot)
  await autoCollectEvidence(dispute.id, claimant_agent_id, task_ids, contract_id);

  return {
    success: true,
    dispute_id: dispute.id,
    filing_bond: filingBond,
    phase_deadline: deadline,
  };
}

// ──────────────────────────────────────────────
// Evidence Management
// ──────────────────────────────────────────────

export interface SubmitEvidenceParams {
  dispute_id: string;
  submitted_by: string;
  side: 'claimant' | 'respondent' | 'neutral';
  type: EvidenceType;
  title: string;
  content: Record<string, unknown>;
}

export interface SubmitEvidenceResult {
  success: boolean;
  evidence_id?: string;
  content_hash?: string;
  error?: string;
}

/**
 * Submit evidence to a dispute. Both parties can submit until arbitration ruling.
 */
export async function submitEvidence(params: SubmitEvidenceParams): Promise<SubmitEvidenceResult> {
  const db = getServiceDb();
  if (!db) return { success: false, error: 'Service unavailable.' };

  // Verify dispute exists and is in an evidence-accepting phase
  const { data: dispute, error: dErr } = await db
    .from('a2a_disputes')
    .select('id, phase, claimant_agent_id, respondent_agent_id')
    .eq('id', params.dispute_id)
    .single();

  if (dErr || !dispute) {
    return { success: false, error: 'Dispute not found.' };
  }

  const evidencePhases: DisputePhase[] = ['negotiation', 'mediation', 'arbitration', 'appealed', 'appeal_review'];
  if (!evidencePhases.includes(dispute.phase)) {
    return { success: false, error: `Cannot submit evidence in '${dispute.phase}' phase.` };
  }

  // Verify submitter is a party to the dispute (or the arbitrator/mediator)
  const isParty = params.submitted_by === dispute.claimant_agent_id
    || params.submitted_by === dispute.respondent_agent_id;
  if (!isParty) {
    return { success: false, error: 'Only dispute parties can submit evidence.' };
  }

  const contentHash = await hashContent(params.content);

  const { data: evidence, error: eErr } = await db
    .from('a2a_dispute_evidence')
    .insert({
      dispute_id: params.dispute_id,
      submitted_by: params.submitted_by,
      side: params.side,
      type: params.type,
      title: params.title,
      content: params.content,
      content_hash: contentHash,
      is_platform_generated: false,
    })
    .select('id')
    .single();

  if (eErr || !evidence) {
    console.error('[Arbitration] Failed to submit evidence:', eErr);
    return { success: false, error: 'Failed to submit evidence.' };
  }

  return { success: true, evidence_id: evidence.id, content_hash: contentHash };
}

/**
 * Auto-collect platform evidence when a dispute is filed.
 * Pulls task records and contract snapshots directly from platform data.
 */
async function autoCollectEvidence(
  disputeId: string,
  claimantId: string,
  taskIds: string[],
  contractId?: string,
): Promise<void> {
  const db = getServiceDb();
  if (!db) return;

  // Collect task records
  if (taskIds.length > 0) {
    const { data: tasks } = await db
      .from('a2a_tasks')
      .select('*')
      .in('id', taskIds);

    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        const contentHash = await hashContent(task);
        await db.from('a2a_dispute_evidence').insert({
          dispute_id: disputeId,
          submitted_by: claimantId,
          side: 'neutral',
          type: 'task_record',
          title: `Task record: ${task.id}`,
          content: task,
          content_hash: contentHash,
          is_platform_generated: true,
        });
      }
    }
  }

  // Collect contract snapshot
  if (contractId) {
    const { data: contract } = await db
      .from('a2a_contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (contract) {
      const contentHash = await hashContent(contract);
      await db.from('a2a_dispute_evidence').insert({
        dispute_id: disputeId,
        submitted_by: claimantId,
        side: 'neutral',
        type: 'contract_snapshot',
        title: `Contract snapshot: ${contract.id}`,
        content: contract,
        content_hash: contentHash,
        is_platform_generated: true,
      });
    }
  }
}

// ──────────────────────────────────────────────
// Negotiation
// ──────────────────────────────────────────────

export interface SendMessageParams {
  dispute_id: string;
  sender_agent_id: string;
  message_type: NegotiationMessageType;
  content: string;
  settlement_offer?: SettlementOffer;
}

export interface SendMessageResult {
  success: boolean;
  message_id?: string;
  round?: number;
  settled?: boolean;
  new_phase?: DisputePhase;
  error?: string;
}

/**
 * Send a negotiation/mediation message in a dispute.
 * If an offer is accepted, auto-advance to 'ruled' with a mutual_settlement outcome.
 */
export async function sendDisputeMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const db = getServiceDb();
  if (!db) return { success: false, error: 'Service unavailable.' };

  const { data: dispute, error: dErr } = await db
    .from('a2a_disputes')
    .select('*')
    .eq('id', params.dispute_id)
    .single();

  if (dErr || !dispute) {
    return { success: false, error: 'Dispute not found.' };
  }

  const negotiablePhases: DisputePhase[] = ['negotiation', 'mediation'];
  if (!negotiablePhases.includes(dispute.phase)) {
    return { success: false, error: `Cannot negotiate in '${dispute.phase}' phase.` };
  }

  // Verify sender is a party
  const isParty = params.sender_agent_id === dispute.claimant_agent_id
    || params.sender_agent_id === dispute.respondent_agent_id;
  if (!isParty && params.sender_agent_id !== dispute.mediator_agent_id) {
    return { success: false, error: 'Only dispute parties or the mediator can send messages.' };
  }

  // Determine round
  const newRound = params.message_type === 'offer' || params.message_type === 'counter_offer'
    ? dispute.negotiation_rounds + 1
    : dispute.negotiation_rounds;

  // Insert message
  const { data: msg, error: mErr } = await db
    .from('a2a_dispute_messages')
    .insert({
      dispute_id: params.dispute_id,
      sender_agent_id: params.sender_agent_id,
      message_type: params.message_type,
      content: params.content,
      settlement_offer: params.settlement_offer ?? null,
      round: newRound,
    })
    .select('id')
    .single();

  if (mErr || !msg) {
    console.error('[Arbitration] Failed to send message:', mErr);
    return { success: false, error: 'Failed to send message.' };
  }

  // Update negotiation round count
  if (newRound > dispute.negotiation_rounds) {
    await db.from('a2a_disputes')
      .update({ negotiation_rounds: newRound, updated_at: new Date().toISOString() })
      .eq('id', params.dispute_id);
  }

  // Handle acceptance — mutual settlement
  if (params.message_type === 'accept') {
    // Find the last offer to capture settlement terms
    const { data: lastOffer } = await db
      .from('a2a_dispute_messages')
      .select('settlement_offer')
      .eq('dispute_id', params.dispute_id)
      .in('message_type', ['offer', 'counter_offer'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Create a mutual settlement ruling
    const settlementDirectives = buildSettlementDirectives(
      dispute,
      lastOffer?.settlement_offer as SettlementOffer | undefined,
    );

    await createRulingInternal(
      params.dispute_id,
      'platform', // Platform acts as the "arbitrator" for mutual settlements
      'mutual_settlement',
      'Both parties reached a mutual settlement during negotiation.',
      [],
      [],
      settlementDirectives,
      1.0,
      false, // not appealable
    );

    await advancePhase(params.dispute_id, 'ruled');

    return {
      success: true,
      message_id: msg.id,
      round: newRound,
      settled: true,
      new_phase: 'ruled',
    };
  }

  // Auto-escalate if max negotiation rounds reached
  if (newRound >= dispute.max_negotiation_rounds && dispute.phase === 'negotiation') {
    await advancePhase(params.dispute_id, 'mediation');
    return {
      success: true,
      message_id: msg.id,
      round: newRound,
      settled: false,
      new_phase: 'mediation',
    };
  }

  return { success: true, message_id: msg.id, round: newRound, settled: false };
}

// ──────────────────────────────────────────────
// Phase Escalation
// ──────────────────────────────────────────────

/**
 * Manually or automatically escalate a dispute to the next phase.
 */
export async function escalateDispute(
  disputeId: string,
  agentId: string,
  reason: string,
): Promise<{ success: boolean; new_phase?: DisputePhase; assigned_agent_id?: string; error?: string }> {
  const db = getServiceDb();
  if (!db) return { success: false, error: 'Service unavailable.' };

  const { data: dispute, error: dErr } = await db
    .from('a2a_disputes')
    .select('*')
    .eq('id', disputeId)
    .single();

  if (dErr || !dispute) {
    return { success: false, error: 'Dispute not found.' };
  }

  // Verify the requester is a party
  const isParty = agentId === dispute.claimant_agent_id || agentId === dispute.respondent_agent_id;
  if (!isParty) {
    return { success: false, error: 'Only dispute parties can escalate.' };
  }

  const escalationMap: Partial<Record<DisputePhase, DisputePhase>> = {
    negotiation: 'mediation',
    mediation: 'arbitration',
  };

  const nextPhase = escalationMap[dispute.phase];
  if (!nextPhase) {
    return { success: false, error: `Cannot escalate from '${dispute.phase}' phase.` };
  }

  let assignedAgentId: string | undefined;

  // Assign mediator or arbitrator
  if (nextPhase === 'mediation') {
    assignedAgentId = await selectMediator(dispute);
  } else if (nextPhase === 'arbitration') {
    assignedAgentId = await selectArbitrator(dispute);
  }

  await advancePhase(disputeId, nextPhase, assignedAgentId);

  return { success: true, new_phase: nextPhase, assigned_agent_id: assignedAgentId };
}

/**
 * Advance a dispute to a new phase.
 */
async function advancePhase(
  disputeId: string,
  newPhase: DisputePhase,
  assignedAgentId?: string,
): Promise<void> {
  const db = getServiceDb();
  if (!db) return;

  const updates: Record<string, unknown> = {
    phase: newPhase,
    phase_deadline: phaseDeadline(DISPUTE_CONFIG.default_phase_timeout_hours),
    updated_at: new Date().toISOString(),
  };

  if (newPhase === 'mediation' && assignedAgentId) {
    updates.mediator_agent_id = assignedAgentId;
  }
  if (newPhase === 'arbitration' && assignedAgentId) {
    updates.arbitrator_agent_id = assignedAgentId;
  }
  if (newPhase === 'closed' || newPhase === 'withdrawn' || newPhase === 'expired') {
    updates.resolved_at = new Date().toISOString();
  }

  await db.from('a2a_disputes').update(updates).eq('id', disputeId);
}

// ──────────────────────────────────────────────
// Arbitrator / Mediator Selection
// ──────────────────────────────────────────────

/**
 * Select a mediator for the dispute.
 * Uses reputation-weighted random selection from qualified agents
 * that have no conflict of interest.
 */
async function selectMediator(dispute: Dispute): Promise<string | undefined> {
  return selectNeutralAgent(dispute, 0.5); // Lower bar for mediators
}

/**
 * Select an arbitrator for the dispute.
 * Higher qualification bar than mediators.
 */
async function selectArbitrator(dispute: Dispute): Promise<string | undefined> {
  return selectNeutralAgent(dispute, DISPUTE_CONFIG.min_arbitrator_reputation);
}

/**
 * Select a neutral agent (mediator or arbitrator) using reputation-weighted
 * random selection with conflict-of-interest filtering.
 */
async function selectNeutralAgent(
  dispute: Dispute,
  minReputation: number,
): Promise<string | undefined> {
  const db = getServiceDb();
  if (!db) return undefined;

  // Find partner-level agents with sufficient reputation
  const { data: candidates } = await db
    .from('a2a_agent_reputation')
    .select('agent_id, reputation_score')
    .gte('reputation_score', minReputation)
    .order('reputation_score', { ascending: false })
    .limit(20);

  if (!candidates || candidates.length === 0) return undefined;

  // Filter out conflict of interest (the disputing parties themselves)
  const conflictIds = new Set([
    dispute.claimant_agent_id,
    dispute.respondent_agent_id,
    dispute.mediator_agent_id,
    dispute.arbitrator_agent_id,
  ].filter(Boolean));

  const eligible = candidates.filter(c => !conflictIds.has(c.agent_id));
  if (eligible.length === 0) return undefined;

  // Reputation-weighted random selection
  const totalReputation = eligible.reduce((sum, c) => sum + Number(c.reputation_score), 0);
  let random = Math.random() * totalReputation;

  for (const candidate of eligible) {
    random -= Number(candidate.reputation_score);
    if (random <= 0) return candidate.agent_id;
  }

  return eligible[0].agent_id;
}

/**
 * Select an appeal panel of 3 arbitrators.
 */
async function selectAppealPanel(dispute: Dispute): Promise<string[]> {
  const db = getServiceDb();
  if (!db) return [];

  const { data: candidates } = await db
    .from('a2a_agent_reputation')
    .select('agent_id, reputation_score')
    .gte('reputation_score', DISPUTE_CONFIG.min_arbitrator_reputation)
    .order('reputation_score', { ascending: false })
    .limit(30);

  if (!candidates) return [];

  // Exclude all previously involved agents
  const conflictIds = new Set([
    dispute.claimant_agent_id,
    dispute.respondent_agent_id,
    dispute.mediator_agent_id,
    dispute.arbitrator_agent_id,
  ].filter(Boolean));

  const eligible = candidates.filter(c => !conflictIds.has(c.agent_id));
  if (eligible.length < DISPUTE_CONFIG.appeal_panel_size) return eligible.map(c => c.agent_id);

  // Select top N by reputation for the appeal panel (deterministic for fairness)
  return eligible.slice(0, DISPUTE_CONFIG.appeal_panel_size).map(c => c.agent_id);
}

// ──────────────────────────────────────────────
// Rulings
// ──────────────────────────────────────────────

export interface IssueRulingParams {
  dispute_id: string;
  arbitrator_agent_id: string;
  outcome: RulingOutcome;
  reasoning: string;
  evidence_considered: string[];
  precedents_applied?: string[];
  enforcement_directives: Omit<EnforcementDirective, 'executed' | 'execution_result' | 'executed_at'>[];
  confidence: number;
  create_precedent?: boolean;
  precedent_principle?: string;
  precedent_key_facts?: string[];
}

export interface IssueRulingResult {
  success: boolean;
  ruling_id?: string;
  precedent_id?: string;
  error?: string;
}

/**
 * Issue a ruling on a dispute.
 * Only the assigned arbitrator (or appeal panel member) can rule.
 */
export async function issueRuling(params: IssueRulingParams): Promise<IssueRulingResult> {
  const db = getServiceDb();
  if (!db) return { success: false, error: 'Service unavailable.' };

  const { data: dispute, error: dErr } = await db
    .from('a2a_disputes')
    .select('*')
    .eq('id', params.dispute_id)
    .single();

  if (dErr || !dispute) {
    return { success: false, error: 'Dispute not found.' };
  }

  // Verify the arbitrator is assigned
  const isArbitrator = params.arbitrator_agent_id === dispute.arbitrator_agent_id;
  const isAppealPanelist = (dispute.appeal_panel_ids ?? []).includes(params.arbitrator_agent_id);
  const isArbitrationPhase = dispute.phase === 'arbitration';
  const isAppealPhase = dispute.phase === 'appeal_review';

  if (isArbitrationPhase && !isArbitrator) {
    return { success: false, error: 'Only the assigned arbitrator can issue a ruling.' };
  }
  if (isAppealPhase && !isAppealPanelist) {
    return { success: false, error: 'Only appeal panel members can issue an appeal ruling.' };
  }
  if (!isArbitrationPhase && !isAppealPhase) {
    return { success: false, error: `Cannot issue ruling in '${dispute.phase}' phase.` };
  }

  const isAppealable = !dispute.has_been_appealed && isArbitrationPhase;
  const appealDeadline = isAppealable
    ? phaseDeadline(DISPUTE_CONFIG.appeal_window_hours)
    : undefined;

  const rulingId = await createRulingInternal(
    params.dispute_id,
    params.arbitrator_agent_id,
    params.outcome,
    params.reasoning,
    params.evidence_considered,
    params.precedents_applied ?? [],
    params.enforcement_directives.map(d => ({
      ...d,
      executed: false,
    })),
    params.confidence,
    isAppealable,
    appealDeadline,
  );

  if (!rulingId) {
    return { success: false, error: 'Failed to create ruling.' };
  }

  // Update dispute phase
  const updateField = isAppealPhase ? 'appeal_ruling' : 'ruling';
  await db.from('a2a_disputes').update({
    phase: 'ruled',
    [updateField]: rulingId,
    precedent_ids: params.precedents_applied ?? [],
    updated_at: new Date().toISOString(),
  }).eq('id', params.dispute_id);

  // Create precedent if requested
  let precedentId: string | undefined;
  if (params.create_precedent && params.precedent_principle) {
    precedentId = await createPrecedent(
      params.dispute_id,
      rulingId,
      dispute.category,
      params.precedent_principle,
      params.precedent_key_facts ?? [],
      params.outcome,
    );
  }

  return { success: true, ruling_id: rulingId, precedent_id: precedentId };
}

/**
 * Internal ruling creation.
 */
async function createRulingInternal(
  disputeId: string,
  arbitratorAgentId: string,
  outcome: RulingOutcome,
  reasoning: string,
  evidenceConsidered: string[],
  precedentsApplied: string[],
  enforcementDirectives: Omit<EnforcementDirective, 'execution_result' | 'executed_at'>[],
  confidence: number,
  isAppealable: boolean,
  appealDeadline?: string,
): Promise<string | null> {
  const db = getServiceDb();
  if (!db) return null;

  const { data, error } = await db
    .from('a2a_dispute_rulings')
    .insert({
      dispute_id: disputeId,
      arbitrator_agent_id: arbitratorAgentId,
      outcome,
      reasoning,
      evidence_considered: evidenceConsidered,
      precedents_applied: precedentsApplied,
      enforcement_directives: enforcementDirectives,
      confidence,
      is_appealable: isAppealable,
      appeal_deadline: appealDeadline ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[Arbitration] Failed to create ruling:', error);
    return null;
  }

  return data.id;
}

// ──────────────────────────────────────────────
// Enforcement
// ──────────────────────────────────────────────

export interface EnforceRulingResult {
  success: boolean;
  directives_executed: number;
  directives_failed: number;
  errors: string[];
}

/**
 * Execute the enforcement directives from a dispute ruling.
 *
 * This is the integration point where arbitration connects to:
 *   - Billing (refunds, penalties)
 *   - Reputation (score adjustments)
 *   - Contracts (termination, modification)
 *   - Governance (suspensions)
 *
 * Each directive is executed independently; failures don't block others.
 */
export async function enforceRuling(disputeId: string): Promise<EnforceRulingResult> {
  const db = getServiceDb();
  if (!db) return { success: false, directives_executed: 0, directives_failed: 0, errors: ['Service unavailable.'] };

  const { data: dispute, error: dErr } = await db
    .from('a2a_disputes')
    .select('*')
    .eq('id', disputeId)
    .single();

  if (dErr || !dispute) {
    return { success: false, directives_executed: 0, directives_failed: 0, errors: ['Dispute not found.'] };
  }

  if (dispute.phase !== 'ruled') {
    return { success: false, directives_executed: 0, directives_failed: 0, errors: [`Cannot enforce in '${dispute.phase}' phase.`] };
  }

  // Get the applicable ruling (appeal ruling takes precedence)
  const rulingId = dispute.appeal_ruling ?? dispute.ruling;
  if (!rulingId) {
    return { success: false, directives_executed: 0, directives_failed: 0, errors: ['No ruling found.'] };
  }

  const { data: ruling, error: rErr } = await db
    .from('a2a_dispute_rulings')
    .select('*')
    .eq('id', rulingId)
    .single();

  if (rErr || !ruling) {
    return { success: false, directives_executed: 0, directives_failed: 0, errors: ['Ruling not found.'] };
  }

  const directives = ruling.enforcement_directives as EnforcementDirective[];
  let executed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const directive of directives) {
    if (directive.executed) {
      executed++;
      continue;
    }

    try {
      await executeDirective(directive, dispute);
      directive.executed = true;
      directive.executed_at = new Date().toISOString();
      directive.execution_result = 'success';
      executed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      directive.executed = false;
      directive.execution_result = `failed: ${msg}`;
      errors.push(`${directive.action}: ${msg}`);
      failed++;
    }
  }

  // Update the ruling with execution results
  await db.from('a2a_dispute_rulings')
    .update({ enforcement_directives: directives })
    .eq('id', rulingId);

  // Advance to enforced/closed
  const allExecuted = failed === 0;
  await advancePhase(disputeId, allExecuted ? 'enforced' : 'enforced');

  // If fully enforced, close
  if (allExecuted) {
    await advancePhase(disputeId, 'closed');
  }

  return { success: allExecuted, directives_executed: executed, directives_failed: failed, errors };
}

/**
 * Execute a single enforcement directive by integrating with platform subsystems.
 */
async function executeDirective(
  directive: EnforcementDirective,
  dispute: Dispute,
): Promise<void> {
  const db = getServiceDb();
  if (!db) throw new Error('Service unavailable');

  switch (directive.action) {
    case 'refund': {
      // Create a refund transaction in the billing ledger
      if (!directive.amount) throw new Error('Refund amount required');
      await db.from('a2a_transactions').insert({
        wallet_id: null, // Will be resolved by billing engine
        agent_id: directive.target_agent_id,
        type: 'refund',
        amount: directive.amount,
        currency: directive.currency ?? dispute.currency,
        status: 'settled',
        contract_id: dispute.contract_id ?? null,
        description: `Arbitration refund for dispute ${dispute.id}`,
        metadata: { dispute_id: dispute.id },
        settled_at: new Date().toISOString(),
      });
      break;
    }

    case 'penalty': {
      if (!directive.amount) throw new Error('Penalty amount required');
      await db.from('a2a_transactions').insert({
        wallet_id: null,
        agent_id: directive.target_agent_id,
        type: 'charge',
        amount: -directive.amount,
        currency: directive.currency ?? dispute.currency,
        status: 'settled',
        description: `Arbitration penalty for dispute ${dispute.id}`,
        metadata: { dispute_id: dispute.id },
        settled_at: new Date().toISOString(),
      });
      break;
    }

    case 'bond_return': {
      await db.from('a2a_transactions').insert({
        wallet_id: null,
        agent_id: dispute.claimant_agent_id,
        type: 'refund',
        amount: dispute.filing_bond,
        currency: dispute.currency,
        status: 'settled',
        description: `Filing bond returned for dispute ${dispute.id}`,
        metadata: { dispute_id: dispute.id },
        settled_at: new Date().toISOString(),
      });
      break;
    }

    case 'bond_forfeit': {
      // Bond stays with the platform (no action needed, just mark as forfeited)
      break;
    }

    case 'reputation_adjustment': {
      if (directive.reputation_delta === undefined) throw new Error('Reputation delta required');
      // Submit artificial feedback to adjust reputation
      await db.from('a2a_task_feedback').insert({
        task_id: dispute.task_ids[0] ?? dispute.id,
        reviewer_agent_id: 'platform-arbitration',
        target_agent_id: directive.target_agent_id,
        rating: directive.reputation_delta > 0 ? 5 : 1,
        feedback: { source: 'arbitration', dispute_id: dispute.id, delta: directive.reputation_delta },
        intent: 'arbitration.ruling',
      });
      break;
    }

    case 'contract_termination': {
      if (!directive.contract_id) throw new Error('Contract ID required');
      await db.from('a2a_contracts').update({
        status: 'terminated',
        termination_reason: `Terminated by arbitration ruling on dispute ${dispute.id}`,
        updated_at: new Date().toISOString(),
      }).eq('id', directive.contract_id);
      break;
    }

    case 'contract_modification': {
      if (!directive.contract_id || !directive.parameters) throw new Error('Contract ID and parameters required');
      await db.from('a2a_contracts').update({
        ...directive.parameters,
        updated_at: new Date().toISOString(),
      }).eq('id', directive.contract_id);
      break;
    }

    case 'agent_warning': {
      // Create a governance audit entry as a formal warning
      await db.from('a2a_governance_audit').insert({
        agent_id: directive.target_agent_id,
        action: 'task.submit', // Generic action for warnings
        decision: 'deny',
        policy_id: 'arbitration',
        reason: `Formal warning from arbitration on dispute ${dispute.id}`,
        metadata: { dispute_id: dispute.id, directive: 'warning' },
      });
      break;
    }

    case 'agent_suspension': {
      // Activate kill switch via governance
      await db.from('a2a_suspensions').insert({
        agent_id: directive.target_agent_id,
        suspended_by: 'platform-arbitration',
        reason: `Suspended by arbitration ruling on dispute ${dispute.id}`,
        status: 'active',
        tasks_cancelled: 0,
        workflows_paused: 0,
        contracts_frozen: 0,
      });
      // Mark agent as inactive
      await db.from('a2a_agents').update({ is_active: false }).eq('id', directive.target_agent_id);
      break;
    }

    case 'precedent_creation': {
      // Handled separately in issueRuling
      break;
    }

    default:
      throw new Error(`Unknown enforcement action: ${directive.action}`);
  }
}

// ──────────────────────────────────────────────
// Appeals
// ──────────────────────────────────────────────

export interface FileAppealParams {
  dispute_id: string;
  appellant_agent_id: string;
  reason: string;
  new_evidence_ids?: string[];
}

export interface FileAppealResult {
  success: boolean;
  appeal_panel_ids?: string[];
  phase_deadline?: string;
  error?: string;
}

/**
 * File an appeal against a ruling.
 * One appeal allowed per dispute, reviewed by a panel of 3 arbitrators.
 */
export async function fileAppeal(params: FileAppealParams): Promise<FileAppealResult> {
  const db = getServiceDb();
  if (!db) return { success: false, error: 'Service unavailable.' };

  const { data: dispute, error: dErr } = await db
    .from('a2a_disputes')
    .select('*')
    .eq('id', params.dispute_id)
    .single();

  if (dErr || !dispute) {
    return { success: false, error: 'Dispute not found.' };
  }

  if (dispute.phase !== 'ruled') {
    return { success: false, error: 'Can only appeal a ruled dispute.' };
  }

  if (dispute.has_been_appealed) {
    return { success: false, error: 'This dispute has already been appealed.' };
  }

  // Verify appellant is a party
  const isParty = params.appellant_agent_id === dispute.claimant_agent_id
    || params.appellant_agent_id === dispute.respondent_agent_id;
  if (!isParty) {
    return { success: false, error: 'Only dispute parties can file an appeal.' };
  }

  // Check appeal deadline
  const { data: ruling } = await db
    .from('a2a_dispute_rulings')
    .select('appeal_deadline, is_appealable')
    .eq('dispute_id', params.dispute_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!ruling?.is_appealable) {
    return { success: false, error: 'This ruling is not appealable.' };
  }

  if (ruling.appeal_deadline && new Date(ruling.appeal_deadline) < new Date()) {
    return { success: false, error: 'Appeal deadline has passed.' };
  }

  // Select appeal panel
  const panelIds = await selectAppealPanel(dispute as Dispute);
  if (panelIds.length === 0) {
    return { success: false, error: 'No qualified appeal panel members available.' };
  }

  const deadline = phaseDeadline(DISPUTE_CONFIG.default_phase_timeout_hours * 2); // Appeal gets more time

  await db.from('a2a_disputes').update({
    phase: 'appeal_review',
    has_been_appealed: true,
    appeal_panel_ids: panelIds,
    phase_deadline: deadline,
    updated_at: new Date().toISOString(),
  }).eq('id', params.dispute_id);

  return {
    success: true,
    appeal_panel_ids: panelIds,
    phase_deadline: deadline,
  };
}

// ──────────────────────────────────────────────
// Withdrawal
// ──────────────────────────────────────────────

/**
 * Claimant withdraws their dispute.
 * Bond is returned if withdrawn before arbitration phase.
 */
export async function withdrawDispute(
  disputeId: string,
  agentId: string,
  reason: string,
): Promise<{ success: boolean; bond_returned: boolean; error?: string }> {
  const db = getServiceDb();
  if (!db) return { success: false, bond_returned: false, error: 'Service unavailable.' };

  const { data: dispute, error: dErr } = await db
    .from('a2a_disputes')
    .select('*')
    .eq('id', disputeId)
    .single();

  if (dErr || !dispute) {
    return { success: false, bond_returned: false, error: 'Dispute not found.' };
  }

  if (agentId !== dispute.claimant_agent_id) {
    return { success: false, bond_returned: false, error: 'Only the claimant can withdraw.' };
  }

  const withdrawablePhases: DisputePhase[] = ['negotiation', 'mediation', 'arbitration'];
  if (!withdrawablePhases.includes(dispute.phase)) {
    return { success: false, bond_returned: false, error: `Cannot withdraw in '${dispute.phase}' phase.` };
  }

  // Bond returned if withdrawn before arbitration (good faith withdrawal)
  const bondReturned = dispute.phase === 'negotiation' || dispute.phase === 'mediation';

  await advancePhase(disputeId, 'withdrawn');

  return { success: true, bond_returned: bondReturned };
}

// ──────────────────────────────────────────────
// Precedent Management
// ──────────────────────────────────────────────

/**
 * Create a precedent from a ruling.
 */
async function createPrecedent(
  disputeId: string,
  rulingId: string,
  category: DisputeCategory,
  principle: string,
  keyFacts: string[],
  outcome: RulingOutcome,
): Promise<string | undefined> {
  const db = getServiceDb();
  if (!db) return undefined;

  const { data, error } = await db
    .from('a2a_dispute_precedents')
    .insert({
      dispute_id: disputeId,
      ruling_id: rulingId,
      category,
      principle,
      description: principle,
      key_facts: keyFacts,
      outcome,
      times_cited: 0,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[Arbitration] Failed to create precedent:', error);
    return undefined;
  }

  return data.id;
}

/**
 * Search precedents by category and keyword for arbitrators to reference.
 */
export async function searchPrecedents(
  category?: DisputeCategory,
  keyword?: string,
  limit: number = 20,
): Promise<DisputePrecedent[]> {
  const db = getServiceDb();
  if (!db) return [];

  let query = db
    .from('a2a_dispute_precedents')
    .select('*')
    .eq('is_active', true)
    .order('times_cited', { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq('category', category);
  }

  if (keyword) {
    query = query.or(`principle.ilike.%${keyword}%,description.ilike.%${keyword}%`);
  }

  const { data, error } = await query;

  if (error || !data) return [];
  return data as DisputePrecedent[];
}

/**
 * Increment the citation count for a precedent.
 */
export async function citePrecedent(precedentId: string): Promise<void> {
  const db = getServiceDb();
  if (!db) return;

  // Use RPC or manual increment
  const { data } = await db
    .from('a2a_dispute_precedents')
    .select('times_cited')
    .eq('id', precedentId)
    .single();

  if (data) {
    await db.from('a2a_dispute_precedents')
      .update({ times_cited: (data.times_cited ?? 0) + 1 })
      .eq('id', precedentId);
  }
}

// ──────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────

/**
 * List disputes for an agent (as claimant or respondent).
 */
export async function listDisputes(
  agentId: string,
  filters?: { phase?: DisputePhase; category?: DisputeCategory; limit?: number },
): Promise<Dispute[]> {
  const db = getServiceDb();
  if (!db) return [];

  let query = db
    .from('a2a_disputes')
    .select('*')
    .or(`claimant_agent_id.eq.${agentId},respondent_agent_id.eq.${agentId}`)
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 50);

  if (filters?.phase) {
    query = query.eq('phase', filters.phase);
  }
  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Dispute[];
}

/**
 * Get full dispute detail with evidence, messages, ruling, and precedents.
 */
export async function getDisputeDetail(disputeId: string): Promise<{
  dispute: Dispute;
  evidence: DisputeEvidence[];
  messages: DisputeMessage[];
  ruling?: DisputeRuling;
  appeal_ruling?: DisputeRuling;
  precedents: DisputePrecedent[];
} | null> {
  const db = getServiceDb();
  if (!db) return null;

  const { data: dispute, error: dErr } = await db
    .from('a2a_disputes')
    .select('*')
    .eq('id', disputeId)
    .single();

  if (dErr || !dispute) return null;

  // Fetch related data in parallel
  const [evidenceRes, messagesRes, rulingsRes] = await Promise.all([
    db.from('a2a_dispute_evidence').select('*').eq('dispute_id', disputeId).order('created_at'),
    db.from('a2a_dispute_messages').select('*').eq('dispute_id', disputeId).order('created_at'),
    db.from('a2a_dispute_rulings').select('*').eq('dispute_id', disputeId).order('created_at'),
  ]);

  // Fetch cited precedents
  const precedentIds = dispute.precedent_ids ?? [];
  let precedents: DisputePrecedent[] = [];
  if (precedentIds.length > 0) {
    const { data: precData } = await db
      .from('a2a_dispute_precedents')
      .select('*')
      .in('id', precedentIds);
    precedents = (precData ?? []) as DisputePrecedent[];
  }

  const rulings = (rulingsRes.data ?? []) as DisputeRuling[];

  return {
    dispute: dispute as Dispute,
    evidence: (evidenceRes.data ?? []) as DisputeEvidence[],
    messages: (messagesRes.data ?? []) as DisputeMessage[],
    ruling: rulings[0],
    appeal_ruling: rulings.length > 1 ? rulings[1] : undefined,
    precedents,
  };
}

// ──────────────────────────────────────────────
// Phase Timeout Check
// ──────────────────────────────────────────────

/**
 * Check for disputes that have exceeded their phase deadline and auto-escalate.
 * Intended to be called periodically (e.g., by a cron job or background worker).
 */
export async function processExpiredPhases(): Promise<{ escalated: number; expired: number }> {
  const db = getServiceDb();
  if (!db) return { escalated: 0, expired: 0 };

  const now = new Date().toISOString();

  const { data: expired, error } = await db
    .from('a2a_disputes')
    .select('id, phase, claimant_agent_id, respondent_agent_id')
    .in('phase', ACTIVE_PHASES)
    .lt('phase_deadline', now);

  if (error || !expired) return { escalated: 0, expired: 0 };

  let escalatedCount = 0;
  let expiredCount = 0;

  for (const dispute of expired) {
    const escalationMap: Partial<Record<DisputePhase, DisputePhase>> = {
      negotiation: 'mediation',
      mediation: 'arbitration',
      filed: 'negotiation',
    };

    const nextPhase = escalationMap[dispute.phase as DisputePhase];
    if (nextPhase) {
      let assignedAgent: string | undefined;
      if (nextPhase === 'mediation') {
        assignedAgent = await selectNeutralAgent(dispute as Dispute, 0.5);
      } else if (nextPhase === 'arbitration') {
        assignedAgent = await selectNeutralAgent(dispute as Dispute, DISPUTE_CONFIG.min_arbitrator_reputation);
      }
      await advancePhase(dispute.id, nextPhase, assignedAgent);
      escalatedCount++;
    } else {
      // Terminal timeout — expire the dispute
      await advancePhase(dispute.id, 'expired');
      expiredCount++;
    }
  }

  return { escalated: escalatedCount, expired: expiredCount };
}

/**
 * Build enforcement directives from a mutual settlement offer.
 */
function buildSettlementDirectives(
  dispute: Dispute,
  offer?: SettlementOffer,
): Omit<EnforcementDirective, 'execution_result' | 'executed_at'>[] {
  const directives: Omit<EnforcementDirective, 'execution_result' | 'executed_at'>[] = [];

  // Always return filing bond on mutual settlement
  directives.push({
    action: 'bond_return',
    target_agent_id: dispute.claimant_agent_id,
    amount: dispute.filing_bond,
    currency: dispute.currency,
    executed: false,
  });

  if (!offer) return directives;

  if (offer.refund_amount > 0) {
    directives.push({
      action: 'refund',
      target_agent_id: dispute.claimant_agent_id,
      amount: offer.refund_amount,
      currency: offer.currency,
      executed: false,
    });
  }

  if (offer.reputation_adjustment !== undefined && offer.reputation_adjustment !== 0) {
    directives.push({
      action: 'reputation_adjustment',
      target_agent_id: dispute.respondent_agent_id,
      reputation_delta: offer.reputation_adjustment,
      executed: false,
    });
  }

  if (offer.modify_contract && dispute.contract_id) {
    directives.push({
      action: 'contract_modification',
      target_agent_id: dispute.respondent_agent_id,
      contract_id: dispute.contract_id,
      parameters: offer.new_sla_terms,
      executed: false,
    });
  }

  return directives;
}
