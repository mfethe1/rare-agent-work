import { z } from 'zod';

// ── Strategy schemas ──────────────────────────────────────────────────

export const RegisterStrategySchema = z.object({
  agentId: z.string().min(1),
  capability: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  parameters: z.record(z.unknown()),
  parentId: z.string().optional(),
});

export const RecordOutcomeSchema = z.object({
  strategyId: z.string().min(1),
  taskId: z.string().min(1),
  agentId: z.string().min(1),
  capability: z.string().min(1),
  success: z.boolean(),
  latencyMs: z.number().nonnegative(),
  qualityScore: z.number().min(0).max(1),
  costCredits: z.number().nonnegative(),
  contextSnapshot: z.record(z.unknown()).optional(),
});

// ── Experiment schemas ────────────────────────────────────────────────

export const CreateExperimentSchema = z.object({
  agentId: z.string().min(1),
  capability: z.string().min(1),
  name: z.string().min(1).max(200),
  hypothesis: z.string().max(2000),
  controlStrategyId: z.string().min(1),
  candidateStrategyIds: z.array(z.string().min(1)).min(1).max(5),
  minSampleSize: z.number().int().min(5).max(1000).optional(),
});

// ── Evolution schemas ─────────────────────────────────────────────────

export const ProposeEvolutionSchema = z.object({
  parentStrategyId: z.string().min(1),
  agentId: z.string().min(1),
  proposedParameters: z.record(z.unknown()),
  rationale: z.string().min(1).max(2000),
  basedOnInsights: z.array(z.string()).optional(),
});

// ── Recommendation query ──────────────────────────────────────────────

export const RecommendSchema = z.object({
  agentId: z.string().min(1),
  capability: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  topK: z.number().int().min(1).max(10).optional(),
});

// ── Insight extraction ────────────────────────────────────────────────

export const ExtractInsightsSchema = z.object({
  agentId: z.string().min(1),
  capability: z.string().min(1),
  minSampleSize: z.number().int().min(5).optional(),
});

export const ShareInsightSchema = z.object({
  insightId: z.string().min(1),
});
