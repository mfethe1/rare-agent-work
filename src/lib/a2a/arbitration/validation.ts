/**
 * Agent Arbitration — Zod Validation Schemas
 *
 * Input validation for all arbitration API endpoints.
 */

import { z } from 'zod';

// ──────────────────────────────────────────────
// Shared Enums
// ──────────────────────────────────────────────

export const DisputeCategorySchema = z.enum([
  'sla_breach',
  'quality_dispute',
  'billing_dispute',
  'non_delivery',
  'unauthorized_action',
  'reputation_abuse',
  'contract_violation',
  'data_misuse',
  'identity_fraud',
  'other',
]);

export const EvidenceTypeSchema = z.enum([
  'task_record',
  'contract_snapshot',
  'message_log',
  'metric_data',
  'transaction_log',
  'reputation_data',
  'testimony',
  'external_data',
  'screenshot',
  'audit_trail',
]);

export const NegotiationMessageTypeSchema = z.enum([
  'statement',
  'offer',
  'counter_offer',
  'accept',
  'reject',
  'question',
  'answer',
]);

export const RulingOutcomeSchema = z.enum([
  'claimant_wins',
  'respondent_wins',
  'partial',
  'mutual_settlement',
  'dismissed',
]);

export const EnforcementActionSchema = z.enum([
  'refund',
  'penalty',
  'reputation_adjustment',
  'contract_termination',
  'contract_modification',
  'agent_warning',
  'agent_suspension',
  'bond_return',
  'bond_forfeit',
  'precedent_creation',
]);

// ──────────────────────────────────────────────
// File Dispute
// ──────────────────────────────────────────────

export const FileDisputeSchema = z.object({
  respondent_agent_id: z.string().uuid(),
  category: DisputeCategorySchema,
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  contract_id: z.string().uuid().optional(),
  task_ids: z.array(z.string().uuid()).max(20).optional(),
  amount_disputed: z.number().positive().max(1_000_000),
  currency: z.string().max(10).optional(),
});

// ──────────────────────────────────────────────
// Submit Evidence
// ──────────────────────────────────────────────

export const SubmitEvidenceSchema = z.object({
  side: z.enum(['claimant', 'respondent', 'neutral']),
  type: EvidenceTypeSchema,
  title: z.string().min(3).max(200),
  content: z.record(z.unknown()),
});

// ──────────────────────────────────────────────
// Negotiate
// ──────────────────────────────────────────────

export const SettlementOfferSchema = z.object({
  refund_amount: z.number().min(0),
  currency: z.string().max(10),
  reputation_adjustment: z.number().min(-1).max(1).optional(),
  modify_contract: z.boolean().optional(),
  new_sla_terms: z.record(z.unknown()).optional(),
  conditions: z.array(z.string().max(500)).max(10).optional(),
});

export const NegotiateSchema = z.object({
  message_type: NegotiationMessageTypeSchema,
  content: z.string().min(1).max(5000),
  settlement_offer: SettlementOfferSchema.optional(),
});

// ──────────────────────────────────────────────
// Escalate
// ──────────────────────────────────────────────

export const EscalateSchema = z.object({
  reason: z.string().min(5).max(1000),
});

// ──────────────────────────────────────────────
// Issue Ruling
// ──────────────────────────────────────────────

export const EnforcementDirectiveSchema = z.object({
  action: EnforcementActionSchema,
  target_agent_id: z.string().uuid(),
  amount: z.number().optional(),
  currency: z.string().max(10).optional(),
  reputation_delta: z.number().min(-1).max(1).optional(),
  contract_id: z.string().uuid().optional(),
  parameters: z.record(z.unknown()).optional(),
});

export const IssueRulingSchema = z.object({
  outcome: RulingOutcomeSchema,
  reasoning: z.string().min(20).max(10000),
  evidence_considered: z.array(z.string().uuid()),
  precedents_applied: z.array(z.string().uuid()).optional(),
  enforcement_directives: z.array(EnforcementDirectiveSchema).min(1).max(20),
  confidence: z.number().min(0).max(1),
  create_precedent: z.boolean().optional(),
  precedent_principle: z.string().max(500).optional(),
  precedent_key_facts: z.array(z.string().max(500)).max(10).optional(),
});

// ──────────────────────────────────────────────
// Appeal
// ──────────────────────────────────────────────

export const AppealSchema = z.object({
  reason: z.string().min(10).max(5000),
  new_evidence_ids: z.array(z.string().uuid()).max(10).optional(),
});

// ──────────────────────────────────────────────
// Withdraw
// ──────────────────────────────────────────────

export const WithdrawSchema = z.object({
  reason: z.string().min(5).max(1000),
});

// ──────────────────────────────────────────────
// Precedent Search
// ──────────────────────────────────────────────

export const PrecedentSearchSchema = z.object({
  category: DisputeCategorySchema.optional(),
  keyword: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
