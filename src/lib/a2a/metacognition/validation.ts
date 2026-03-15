/**
 * A2A Metacognition & Recursive Self-Improvement — Zod Validation Schemas
 */

import { z } from 'zod';

// ── Shared Enums ────────────────────────────────────────────────────────────

const taskOutcomeSchema = z.enum([
  'success', 'partial_success', 'failure', 'timeout', 'rejected',
]);

const decisionQualitySchema = z.enum([
  'optimal', 'acceptable', 'suboptimal', 'harmful',
]);

const blindSpotTypeSchema = z.enum([
  'perceptual', 'reasoning', 'domain', 'adversarial',
  'cultural', 'temporal', 'relational',
]);

const cycleTriggerSchema = z.enum([
  'scheduled', 'performance_drop', 'failure_spike',
  'blind_spot_alert', 'peer_improvement', 'manual',
]);

const strategyStatusSchema = z.enum([
  'hypothesis', 'testing', 'validated', 'adopted', 'rejected', 'deprecated',
]);

// ── Decision Point Schema ───────────────────────────────────────────────────

const decisionPointInputSchema = z.object({
  step_index: z.number().int().min(0),
  description: z.string().min(1).max(2000),
  alternatives_considered: z.array(z.string().max(1000)).max(20).default([]),
  chosen_action: z.string().min(1).max(2000),
  rationale: z.string().min(1).max(5000),
  quality: decisionQualitySchema,
  counterfactual_impact: z.number().min(-1).max(1),
  confidence_at_time: z.number().min(0).max(1),
});

// ── Introspect ──────────────────────────────────────────────────────────────

export const introspectSchema = z.object({
  agent_id: z.string().uuid(),
  task_id: z.string().uuid(),
  task_domain: z.string().min(1).max(200),
  outcome: taskOutcomeSchema,
  decision_points: z.array(decisionPointInputSchema).min(1).max(100),
  root_cause: z.string().max(5000).optional(),
  lessons_learned: z.array(z.string().max(2000)).max(20).default([]),
});
export type IntrospectInput = z.infer<typeof introspectSchema>;

// ── Generate Strategies ─────────────────────────────────────────────────────

export const generateStrategiesSchema = z.object({
  agent_id: z.string().uuid(),
  target_weakness_ids: z.array(z.string().uuid()).min(1).max(10),
  max_strategies: z.number().int().min(1).max(10).default(5),
});
export type GenerateStrategiesInput = z.infer<typeof generateStrategiesSchema>;

// ── Record Strategy Test Result ─────────────────────────────────────────────

export const recordTestResultSchema = z.object({
  strategy_id: z.string().uuid(),
  test_task_ids: z.array(z.string().uuid()).min(1).max(100),
  control_task_ids: z.array(z.string().uuid()).max(100).default([]),
  improvement_measured: z.number().min(-1).max(1),
  statistical_significance: z.number().min(0).max(1),
  sample_size: z.number().int().min(1),
  side_effects: z.array(z.string().max(1000)).max(20).default([]),
});
export type RecordTestResultInput = z.infer<typeof recordTestResultSchema>;

// ── Start Improvement Cycle ─────────────────────────────────────────────────

export const startImprovementCycleSchema = z.object({
  agent_id: z.string().uuid(),
  trigger: cycleTriggerSchema,
  focus_domains: z.array(z.string().max(200)).max(10).optional(),
});
export type StartImprovementCycleInput = z.infer<typeof startImprovementCycleSchema>;

// ── Advance Improvement Cycle ───────────────────────────────────────────────

export const advanceCycleSchema = z.object({
  cycle_id: z.string().uuid(),
});
export type AdvanceCycleInput = z.infer<typeof advanceCycleSchema>;

// ── Get Cognitive Profile ───────────────────────────────────────────────────

export const getCognitiveProfileSchema = z.object({
  agent_id: z.string().uuid(),
});
export type GetCognitiveProfileInput = z.infer<typeof getCognitiveProfileSchema>;

// ── Get Blind Spots ─────────────────────────────────────────────────────────

export const getBlindSpotsSchema = z.object({
  agent_id: z.string().uuid(),
  min_confidence: z.number().min(0).max(1).optional(),
  type: blindSpotTypeSchema.optional(),
});
export type GetBlindSpotsInput = z.infer<typeof getBlindSpotsSchema>;

// ── Adopt Strategy ──────────────────────────────────────────────────────────

export const adoptStrategySchema = z.object({
  strategy_id: z.string().uuid(),
});
export type AdoptStrategyInput = z.infer<typeof adoptStrategySchema>;

// ── Propagate Improvement ───────────────────────────────────────────────────

export const propagateImprovementSchema = z.object({
  source_agent_id: z.string().uuid(),
  strategy_id: z.string().uuid(),
  target_agent_ids: z.array(z.string().uuid()).min(1).max(100),
});
export type PropagateImprovementInput = z.infer<typeof propagateImprovementSchema>;

// ── Record Propagation Response ─────────────────────────────────────────────

export const recordPropagationResponseSchema = z.object({
  propagation_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  action: z.enum(['adopted', 'rejected']),
  improvement_delta: z.number().min(-1).max(1),
});
export type RecordPropagationResponseInput = z.infer<typeof recordPropagationResponseSchema>;
