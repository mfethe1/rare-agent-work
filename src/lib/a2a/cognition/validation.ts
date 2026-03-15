/**
 * Collective Cognition Protocol — Validation Schemas
 *
 * Loop 30: Zod schemas for all cognition API inputs.
 */

import { z } from 'zod';

// ── Enums ───────────────────────────────────────────────────────────────────

const thoughtTypeSchema = z.enum([
  'hypothesis', 'evidence', 'inference', 'analogy', 'objection',
  'refinement', 'synthesis', 'question', 'assumption', 'decomposition',
  'reframe', 'meta',
]);

const thoughtRelationSchema = z.enum([
  'builds_on', 'challenges', 'refines', 'synthesizes',
  'decomposes', 'analogizes', 'supports', 'reframes',
]);

const cognitiveStrengthSchema = z.enum([
  'analytical', 'creative', 'critical', 'integrative',
  'domain_expert', 'systems_thinker', 'empirical', 'adversarial',
]);

const synthesisMethodSchema = z.enum([
  'convergence', 'dialectic', 'abductive', 'analogical',
  'compositional', 'reductive', 'emergent',
]);

// ── Mesh Configuration ──────────────────────────────────────────────────────

const meshConfigSchema = z.object({
  max_agents: z.number().int().min(2).max(100).optional(),
  min_agents_for_synthesis: z.number().int().min(2).max(50).optional(),
  max_depth: z.number().int().min(3).max(100).optional(),
  resonance_threshold: z.number().min(0).max(1).optional(),
  dissonance_threshold: z.number().min(0).max(1).optional(),
  idle_timeout_seconds: z.number().int().min(60).max(86_400).optional(),
  auto_synthesize: z.boolean().optional(),
  min_confidence_for_resonance: z.number().min(0).max(1).optional(),
  attention_decay_rate: z.number().min(0).max(1).optional(),
  allow_meta_cognition: z.boolean().optional(),
}).strict();

// ── Create Mesh ─────────────────────────────────────────────────────────────

export const createMeshSchema = z.object({
  name: z.string().min(1).max(200),
  problem_statement: z.string().min(1).max(5000),
  context: z.string().max(10_000).optional(),
  config: meshConfigSchema.optional(),
  invite_agents: z.array(z.string().uuid()).max(100).optional(),
}).strict();

export type CreateMeshInput = z.infer<typeof createMeshSchema>;

// ── Join Mesh ───────────────────────────────────────────────────────────────

export const joinMeshSchema = z.object({
  strengths: z.array(cognitiveStrengthSchema).max(5).optional(),
}).strict();

export type JoinMeshInput = z.infer<typeof joinMeshSchema>;

// ── Contribute Thought ──────────────────────────────────────────────────────

export const contributeThoughtSchema = z.object({
  type: thoughtTypeSchema,
  content: z.string().min(1).max(10_000),
  evidence: z.record(z.string(), z.unknown()).optional(),
  parent_id: z.string().uuid().optional(),
  relation: thoughtRelationSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  new_branch: z.boolean().optional(),
  branch_label: z.string().max(200).optional(),
}).strict().refine(
  (data) => {
    // If parent_id is set, relation must also be set
    if (data.parent_id && !data.relation) return false;
    // If relation is set, parent_id must also be set
    if (data.relation && !data.parent_id) return false;
    return true;
  },
  { message: 'parent_id and relation must both be present or both absent' },
).refine(
  (data) => {
    // new_branch requires branch_label
    if (data.new_branch && !data.branch_label) return false;
    return true;
  },
  { message: 'branch_label is required when new_branch is true' },
);

export type ContributeThoughtInput = z.infer<typeof contributeThoughtSchema>;

// ── Synthesize ──────────────────────────────────────────────────────────────

export const synthesizeSchema = z.object({
  thought_ids: z.array(z.string().uuid()).min(2).max(50).optional(),
  branch_ids: z.array(z.string().uuid()).min(2).max(20).optional(),
  method: synthesisMethodSchema.optional(),
}).strict().refine(
  (data) => data.thought_ids || data.branch_ids,
  { message: 'At least one of thought_ids or branch_ids is required' },
);

export type SynthesizeInput = z.infer<typeof synthesizeSchema>;

// ── Endorse Insight ─────────────────────────────────────────────────────────

export const endorseInsightSchema = z.object({
  confidence: z.number().min(0).max(1).optional(),
}).strict();

export type EndorseInsightInput = z.infer<typeof endorseInsightSchema>;

// ── Shift Attention ─────────────────────────────────────────────────────────

export const shiftAttentionSchema = z.object({
  branch_id: z.string().uuid(),
  reason: z.string().min(1).max(1000),
}).strict();

export type ShiftAttentionInput = z.infer<typeof shiftAttentionSchema>;
