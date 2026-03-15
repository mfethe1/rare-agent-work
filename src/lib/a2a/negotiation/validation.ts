/**
 * Agent Negotiation & Strategic Bargaining Protocol — Validation
 *
 * Zod schemas for all negotiation API inputs.
 */

import { z } from 'zod';
import { CONCESSION_STRATEGIES, NEGOTIATION_DOMAINS } from './types';

// ──────────────────────────────────────────────
// Shared Schemas
// ──────────────────────────────────────────────

const issueValueSchema = z.object({
  issue_id: z.string().min(1),
  value: z.union([z.number(), z.string(), z.boolean()]),
});

const issuePreferenceSchema = z.object({
  issue_id: z.string().min(1),
  weight: z.number().min(0).max(1),
  ideal_value: z.union([z.number(), z.string(), z.boolean()]),
  reservation_value: z.union([z.number(), z.string(), z.boolean()]),
  utility_curve: z.enum(['linear', 'concave', 'convex', 'step']).optional(),
});

const negotiationIssueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['numeric', 'categorical', 'boolean', 'package']),
  description: z.string().optional(),
  min_value: z.number().optional(),
  max_value: z.number().optional(),
  options: z.array(z.string()).optional(),
  sub_issues: z.array(z.string()).optional(),
  mandatory: z.boolean(),
});

const concessionStrategySchema = z.enum(
  CONCESSION_STRATEGIES as [string, ...string[]],
);

const strategyParamsSchema = z.object({
  beta: z.number().min(0.01).max(100).optional(),
  hybrid_weights: z.record(z.string(), z.number()).optional(),
  min_concession: z.number().min(0).max(1).optional(),
  max_concession: z.number().min(0).max(1).optional(),
}).optional();

const batnaSchema = z.object({
  alternative_utility: z.number().min(0).max(1),
  description: z.string().min(1),
  confidence: z.number().min(0).max(1),
  time_decay_rate: z.number().optional(),
}).optional();

const deadlinePressureSchema = z.object({
  deadline: z.string().datetime(),
  pressure_curve: z.enum(['linear', 'exponential', 'step']),
  pressure_threshold: z.number().min(0).max(1),
  max_pressure_multiplier: z.number().min(1).max(10),
}).optional();

const mediationConfigSchema = z.object({
  deadlock_threshold: z.number().int().min(1).max(100),
  mediator_agent_id: z.string().optional(),
  mediation_strategy: z.enum([
    'split_difference',
    'single_text',
    'interest_based',
    'binding_arbitration',
  ]),
  binding: z.boolean(),
}).optional();

// ──────────────────────────────────────────────
// Request Schemas
// ──────────────────────────────────────────────

export const createNegotiationSchema = z.object({
  domain: z.enum(NEGOTIATION_DOMAINS as [string, ...string[]]),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  issues: z.array(negotiationIssueSchema).min(1).max(50),
  initiator: z.object({
    agent_id: z.string().min(1),
    strategy: concessionStrategySchema,
    strategy_params: strategyParamsSchema,
    preferences: z.array(issuePreferenceSchema).min(1),
    batna: batnaSchema,
  }),
  max_rounds: z.number().int().min(1).max(1000).optional(),
  min_rounds: z.number().int().min(1).max(100).optional(),
  deadline: deadlinePressureSchema,
  mediation: mediationConfigSchema,
});

export const joinNegotiationSchema = z.object({
  negotiation_id: z.string().min(1),
  agent_id: z.string().min(1),
  role: z.enum(['initiator', 'responder', 'mediator', 'observer']).optional(),
  strategy: concessionStrategySchema,
  strategy_params: strategyParamsSchema,
  preferences: z.array(issuePreferenceSchema).min(1),
  batna: batnaSchema,
});

export const makeOfferSchema = z.object({
  negotiation_id: z.string().min(1),
  from_agent_id: z.string().min(1),
  proposed_values: z.array(issueValueSchema).min(1),
  message: z.string().max(1000).optional(),
  expires_in_ms: z.number().int().positive().optional(),
});

export const respondToOfferSchema = z.object({
  negotiation_id: z.string().min(1),
  offer_id: z.string().min(1),
  agent_id: z.string().min(1),
  action: z.enum(['accept', 'reject', 'counter']),
  counter_values: z.array(issueValueSchema).optional(),
  message: z.string().max(1000).optional(),
});

export const computeZOPASchema = z.object({
  negotiation_id: z.string().min(1),
});

export const paretoAnalysisSchema = z.object({
  negotiation_id: z.string().min(1),
  offer_id: z.string().optional(),
});

export const triggerMediationSchema = z.object({
  negotiation_id: z.string().min(1),
  mediator_agent_id: z.string().optional(),
  reason: z.string().min(1).max(500),
});

export const signAgreementSchema = z.object({
  negotiation_id: z.string().min(1),
  agent_id: z.string().min(1),
});

export const generateCounterOfferSchema = z.object({
  negotiation_id: z.string().min(1),
  agent_id: z.string().min(1),
  override_strategy: concessionStrategySchema.optional(),
});

export const listNegotiationsSchema = z.object({
  domain: z.enum(NEGOTIATION_DOMAINS as [string, ...string[]]).optional(),
  status: z.enum([
    'initiated', 'proposing', 'bargaining', 'converging',
    'agreed', 'failed', 'mediated', 'expired', 'cancelled',
  ] as [string, ...string[]]).optional(),
  agent_id: z.string().optional(),
});

// ──────────────────────────────────────────────
// Type Exports
// ──────────────────────────────────────────────

export type CreateNegotiationInput = z.infer<typeof createNegotiationSchema>;
export type JoinNegotiationInput = z.infer<typeof joinNegotiationSchema>;
export type MakeOfferInput = z.infer<typeof makeOfferSchema>;
export type RespondToOfferInput = z.infer<typeof respondToOfferSchema>;
export type ComputeZOPAInput = z.infer<typeof computeZOPASchema>;
export type ParetoAnalysisInput = z.infer<typeof paretoAnalysisSchema>;
export type TriggerMediationInput = z.infer<typeof triggerMediationSchema>;
export type SignAgreementInput = z.infer<typeof signAgreementSchema>;
export type GenerateCounterOfferInput = z.infer<typeof generateCounterOfferSchema>;
export type ListNegotiationsInput = z.infer<typeof listNegotiationsSchema>;
