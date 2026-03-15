/**
 * Zod validation schemas for Agent Service Contract endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

// ──────────────────────────────────────────────
// SLA Schema
// ──────────────────────────────────────────────

export const slaSchema = z.object({
  max_latency_ms: z.number().int().min(100).max(300_000).optional(),
  min_uptime_percent: z.number().min(0).max(100).optional(),
  min_quality_rating: z.number().min(1).max(5).optional(),
  max_failure_rate_percent: z.number().min(0).max(100).optional(),
  max_daily_throughput: z.number().int().min(0).max(1_000_000).optional(),
});

// ──────────────────────────────────────────────
// Pricing Schema
// ──────────────────────────────────────────────

const pricingTierSchema = z.object({
  up_to_tasks: z.number().int().min(1),
  cost_per_task: z.number().min(0),
});

export const pricingSchema = z.object({
  model: z.enum(['per_task', 'subscription', 'tiered', 'free']),
  currency: trimmed(16).default('credits'),
  per_task_cost: z.number().min(0).optional(),
  subscription_cost: z.number().min(0).optional(),
  billing_period_days: z.number().int().min(1).max(365).optional(),
  tiers: z.array(pricingTierSchema).max(10).optional(),
});

// ──────────────────────────────────────────────
// Contract Proposal — POST /api/a2a/contracts
// ──────────────────────────────────────────────

export const contractProposeSchema = z.object({
  provider_agent_id: z.string().uuid('Provider agent ID must be a valid UUID'),
  capabilities: z.array(trimmed(128).min(1)).min(1, 'At least one capability is required').max(20),
  sla: slaSchema,
  pricing: pricingSchema,
  duration_days: z.number().int().min(1).max(365).default(30),
  max_negotiation_rounds: z.number().int().min(1).max(20).default(5),
  rationale: trimmed(2000).optional(),
});

export type ContractProposeInput = z.infer<typeof contractProposeSchema>;

// ──────────────────────────────────────────────
// Negotiation — POST /api/a2a/contracts/:id/negotiate
// ──────────────────────────────────────────────

export const contractNegotiateSchema = z.object({
  action: z.enum(['counter', 'accept', 'reject']),
  proposed_sla: slaSchema.optional(),
  proposed_pricing: pricingSchema.optional(),
  proposed_duration_days: z.number().int().min(1).max(365).optional(),
  rationale: trimmed(2000).optional(),
}).refine(
  (data) => {
    // Counter-proposals must include at least one changed term
    if (data.action === 'counter') {
      return data.proposed_sla || data.proposed_pricing || data.proposed_duration_days;
    }
    return true;
  },
  { message: 'Counter-proposals must include at least one proposed term (sla, pricing, or duration).' },
);

export type ContractNegotiateInput = z.infer<typeof contractNegotiateSchema>;

// ──────────────────────────────────────────────
// Contract List Query — GET /api/a2a/contracts
// ──────────────────────────────────────────────

export const contractListSchema = z.object({
  status: z.enum(['proposed', 'negotiating', 'active', 'completed', 'terminated', 'breached']).optional(),
  role: z.enum(['provider', 'consumer', 'any']).default('any'),
  capability: trimmed(128).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type ContractListInput = z.infer<typeof contractListSchema>;

// ──────────────────────────────────────────────
// Contract Termination — POST /api/a2a/contracts/:id/terminate
// ──────────────────────────────────────────────

export const contractTerminateSchema = z.object({
  reason: trimmed(2000).min(1, 'Termination reason is required'),
});

export type ContractTerminateInput = z.infer<typeof contractTerminateSchema>;
