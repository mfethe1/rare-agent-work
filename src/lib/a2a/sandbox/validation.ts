/**
 * Zod validation schemas for Agent Safety Sandbox endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

// ──────────────────────────────────────────────
// Shared enums
// ──────────────────────────────────────────────

const invariantCategorySchema = z.enum([
  'resource_bounds',
  'information_flow',
  'action_scope',
  'termination',
  'idempotency',
  'graceful_failure',
  'honesty',
  'consent',
]);

const invariantSeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);

const checkOperatorSchema = z.enum([
  'eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'subset_of', 'disjoint_from', 'matches',
]);

const campaignTypeSchema = z.enum([
  'certification', 'red_team', 'stress', 'regression', 'compliance',
]);

const gatedTrustLevelSchema = z.enum(['verified', 'partner']);

// ──────────────────────────────────────────────
// Invariant Check
// ──────────────────────────────────────────────

const invariantCheckSchema = z.object({
  metric: trimmed(128).min(1, 'Metric name is required'),
  op: checkOperatorSchema,
  threshold: z.number().optional(),
  allowed: z.array(trimmed(256)).max(100).optional(),
  disallowed: z.array(trimmed(256)).max(100).optional(),
  pattern: trimmed(512).optional(),
}).refine(
  (data) => {
    // Numeric ops require threshold
    if (['eq', 'neq', 'lt', 'lte', 'gt', 'gte'].includes(data.op)) {
      return data.threshold !== undefined;
    }
    // Set ops require their respective arrays
    if (data.op === 'subset_of') return data.allowed !== undefined;
    if (data.op === 'disjoint_from') return data.disallowed !== undefined;
    if (data.op === 'matches') return data.pattern !== undefined;
    return true;
  },
  { message: 'Check parameters must match the operator type' },
);

// ──────────────────────────────────────────────
// Create Invariant — POST /api/a2a/sandbox/invariants
// ──────────────────────────────────────────────

export const createInvariantSchema = z.object({
  name: trimmed(256).min(1, 'Invariant name is required'),
  description: trimmed(2000).min(1, 'Description is required'),
  category: invariantCategorySchema,
  severity: invariantSeveritySchema,
  check: invariantCheckSchema,
  is_mandatory: z.boolean().default(false),
  applies_from_trust_level: trimmed(64).optional(),
});

export type CreateInvariantInput = z.infer<typeof createInvariantSchema>;

// ──────────────────────────────────────────────
// List Invariants — GET /api/a2a/sandbox/invariants
// ──────────────────────────────────────────────

export const listInvariantsSchema = z.object({
  category: invariantCategorySchema.optional(),
  severity: invariantSeveritySchema.optional(),
  is_mandatory: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export type ListInvariantsInput = z.infer<typeof listInvariantsSchema>;

// ──────────────────────────────────────────────
// Expected Property (for scenarios)
// ──────────────────────────────────────────────

const expectedPropertySchema = z.object({
  description: trimmed(500).min(1),
  metric: trimmed(128).min(1),
  op: checkOperatorSchema,
  threshold: z.number().optional(),
  allowed: z.array(trimmed(256)).max(100).optional(),
  pattern: trimmed(512).optional(),
});

// ──────────────────────────────────────────────
// Resource Limits
// ──────────────────────────────────────────────

const resourceLimitsSchema = z.object({
  max_execution_ms: z.number().int().min(1000).max(600000).default(60000),
  max_actions: z.number().int().min(1).max(10000).default(100),
  max_cost_credits: z.number().min(0).max(10000).default(100),
  max_context_writes: z.number().int().min(0).max(1000).default(50),
  max_outbound_messages: z.number().int().min(0).max(500).default(20),
});

// ──────────────────────────────────────────────
// Evaluation Scenario
// ──────────────────────────────────────────────

const evaluationScenarioSchema = z.object({
  name: trimmed(256).min(1, 'Scenario name is required'),
  description: trimmed(2000),
  task_intent: trimmed(256).min(1, 'Task intent is required'),
  task_input: z.record(z.unknown()).default({}),
  expected_properties: z.array(expectedPropertySchema).max(50).default([]),
  resource_overrides: resourceLimitsSchema.partial().optional(),
  order: z.number().int().min(0).default(0),
});

// ──────────────────────────────────────────────
// Create Campaign — POST /api/a2a/sandbox/campaigns
// ──────────────────────────────────────────────

export const createCampaignSchema = z.object({
  name: trimmed(256).min(1, 'Campaign name is required'),
  description: trimmed(2000).min(1, 'Description is required'),
  type: campaignTypeSchema,
  agent_id: z.string().uuid('Agent ID must be a valid UUID'),
  scenarios: z.array(evaluationScenarioSchema).min(1, 'At least one scenario is required').max(100),
  invariant_ids: z.array(z.string().uuid()).min(1, 'At least one invariant is required').max(50),
  pass_threshold: z.number().min(0).max(1).default(0.8),
  target_trust_level: trimmed(64).min(1, 'Target trust level is required'),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

// ──────────────────────────────────────────────
// List Campaigns — GET /api/a2a/sandbox/campaigns
// ──────────────────────────────────────────────

export const listCampaignsSchema = z.object({
  agent_id: z.string().uuid().optional(),
  type: campaignTypeSchema.optional(),
  status: z.enum(['draft', 'running', 'passed', 'failed', 'cancelled']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type ListCampaignsInput = z.infer<typeof listCampaignsSchema>;

// ──────────────────────────────────────────────
// Trust Gate — POST /api/a2a/sandbox/trust-gate
// ──────────────────────────────────────────────

export const trustGateSchema = z.object({
  agent_id: z.string().uuid('Agent ID must be a valid UUID'),
  requested_trust_level: gatedTrustLevelSchema,
  campaign_ids: z.array(z.string().uuid()).min(1, 'At least one campaign is required').max(20),
});

export type TrustGateInput = z.infer<typeof trustGateSchema>;

// ──────────────────────────────────────────────
// Anomaly Check — POST /api/a2a/sandbox/anomaly-check
// ──────────────────────────────────────────────

export const anomalyCheckSchema = z.object({
  agent_id: z.string().uuid('Agent ID must be a valid UUID'),
  current_metrics: z.object({
    actions_count: z.number().int().min(0),
    cost_credits: z.number().min(0),
    latency_ms: z.number().min(0),
    data_destinations: z.array(trimmed(256)).max(50),
    scope_adherence: z.number().min(0).max(1),
  }),
});

export type AnomalyCheckInput = z.infer<typeof anomalyCheckSchema>;
