/**
 * A2A Noosphere — Request Validation Schemas
 */

import { z } from 'zod';

export const createSessionSchema = z.object({
  goal: z.string().min(1).max(2000),
  goalType: z.enum([
    'problem_solving', 'hypothesis_generation', 'creative_synthesis',
    'adversarial_analysis', 'knowledge_integration', 'decision_making',
    'root_cause_analysis', 'futures_exploration',
  ]),
  initiatorAgentId: z.string().uuid(),
  requiredDomains: z.array(z.string()).min(1).max(20),
  minParticipants: z.number().int().min(2).max(100).optional(),
  maxParticipants: z.number().int().min(2).max(100).optional(),
  attentionBudget: z.object({
    maxCognitiveUnits: z.number().positive().optional(),
    maxDurationMs: z.number().positive().optional(),
    maxContributions: z.number().int().positive().optional(),
    perAgentLimit: z.number().int().positive().optional(),
  }).optional(),
  constitutionalConstraints: z.array(z.object({
    id: z.string(),
    rule: z.string(),
    scope: z.array(z.enum(['all', 'hypothesis', 'conclusion', 'action_proposal'])),
    severity: z.enum(['hard', 'soft']),
    violationPattern: z.string().optional(),
    prohibitedTopics: z.array(z.string()).optional(),
  })).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const joinSessionSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  domains: z.array(z.string()).min(1),
});

export const contributeThoughtSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  type: z.enum([
    'observation', 'hypothesis', 'evidence', 'critique', 'synthesis',
    'refinement', 'question', 'action_proposal', 'meta_cognitive',
  ]),
  content: z.string().min(1).max(10000),
  confidence: z.number().min(0).max(1),
  parentThoughtIds: z.array(z.string().uuid()).optional(),
  contradicts: z.array(z.string().uuid()).optional(),
  domain: z.string().min(1),
  embedding: z.array(z.number()).optional(),
});

export const endorseThoughtSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  thoughtId: z.string().uuid(),
  strength: z.number().min(-1).max(1),
  reason: z.string().min(1).max(1000),
});

export const createArtifactSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  type: z.enum([
    'hypothesis_set', 'evidence_map', 'contradiction_log', 'synthesis_draft',
    'decision_matrix', 'causal_model', 'knowledge_fragment', 'action_plan',
  ]),
  content: z.record(z.unknown()),
  sourceThoughtIds: z.array(z.string().uuid()).optional(),
});

export const updateArtifactSchema = z.object({
  sessionId: z.string().uuid(),
  artifactId: z.string().uuid(),
  agentId: z.string().uuid(),
  delta: z.record(z.unknown()),
  rationale: z.string().min(1).max(1000),
});

export const signalAttentionSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  type: z.enum([
    'focus_request', 'breakthrough', 'contradiction_found', 'convergence_signal',
    'divergence_needed', 'resource_warning', 'stagnation_alert',
  ]),
  target: z.string().min(1).max(500),
  priority: z.number().min(0).max(1),
  context: z.string().min(1).max(2000),
});

export const fuseInsightsSchema = z.object({
  sessionId: z.string().uuid(),
  thoughtIds: z.array(z.string().uuid()).min(2),
  strategy: z.enum([
    'weighted_aggregation', 'dialectical_synthesis', 'coherence_maximization',
    'majority_crystallization', 'hierarchical_abstraction', 'adversarial_refinement',
  ]),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  includeDissent: z.boolean().optional(),
});

export const concludeSessionSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  reason: z.string().min(1).max(1000),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type JoinSessionInput = z.infer<typeof joinSessionSchema>;
export type ContributeThoughtInput = z.infer<typeof contributeThoughtSchema>;
export type EndorseThoughtInput = z.infer<typeof endorseThoughtSchema>;
export type CreateArtifactInput = z.infer<typeof createArtifactSchema>;
export type UpdateArtifactInput = z.infer<typeof updateArtifactSchema>;
export type SignalAttentionInput = z.infer<typeof signalAttentionSchema>;
export type FuseInsightsInput = z.infer<typeof fuseInsightsSchema>;
export type ConcludeSessionInput = z.infer<typeof concludeSessionSchema>;
