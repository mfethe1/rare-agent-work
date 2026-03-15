import { z } from 'zod';

// ── Memory Bank schemas ──────────────────────────────────────────────

export const CreateBankSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  retention: z
    .object({
      maxEpisodes: z.number().int().min(10).max(100000).optional(),
      consolidateAfterHours: z.number().min(1).max(8760).optional(),
      purgeAfterHours: z.number().min(1).max(87600).optional(),
      autoConsolidate: z.boolean().optional(),
    })
    .optional(),
  tags: z.array(z.string().max(64)).max(20).optional(),
});

// ── Episode schemas ──────────────────────────────────────────────────

const episodeTypes = z.enum([
  'task_execution',
  'interaction',
  'observation',
  'decision',
  'error_recovery',
  'learning',
  'feedback',
  'collaboration',
]);

const valenceEnum = z.enum(['positive', 'neutral', 'negative', 'mixed']);

export const RecordEpisodeSchema = z.object({
  bankId: z.string().min(1),
  type: episodeTypes,
  summary: z.string().min(1).max(500),
  content: z.string().min(1).max(10000),
  context: z
    .object({
      taskId: z.string().optional(),
      involvedAgentIds: z.array(z.string()).max(50).optional(),
      capability: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .optional(),
  importance: z.number().min(0).max(1).optional(),
  valence: valenceEnum.optional(),
  tags: z.array(z.string().max(64)).max(30).optional(),
  relatedEpisodeIds: z.array(z.string()).max(20).optional(),
});

// ── Recall schemas ───────────────────────────────────────────────────

export const RecallSchema = z.object({
  query: z.string().max(1000).optional(),
  types: z.array(episodeTypes).optional(),
  bankId: z.string().optional(),
  tags: z.array(z.string()).max(20).optional(),
  involvedAgentIds: z.array(z.string()).max(10).optional(),
  after: z.string().datetime().optional(),
  before: z.string().datetime().optional(),
  minImportance: z.number().min(0).max(1).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  weights: z
    .object({
      relevance: z.number().min(0).max(1).optional(),
      recency: z.number().min(0).max(1).optional(),
      importance: z.number().min(0).max(1).optional(),
      frequency: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

// ── Consolidation schemas ────────────────────────────────────────────

const consolidationStrategies = z.enum([
  'summarize',
  'extract_pattern',
  'distill_lesson',
  'timeline',
  'deduplicate',
]);

export const ConsolidateSchema = z.object({
  bankId: z.string().min(1),
  sourceEpisodeIds: z.array(z.string().min(1)).min(2).max(100),
  strategy: consolidationStrategies,
});

// ── Sharing schemas ──────────────────────────────────────────────────

const shareVisibility = z.enum(['private', 'specific_agents', 'organization', 'public']);

export const ShareEpisodeSchema = z.object({
  episodeId: z.string().min(1),
  visibility: shareVisibility,
  targetAgentIds: z.array(z.string()).max(50).optional(),
  redactFields: z.array(z.string().max(64)).max(20).optional(),
  expiresAt: z.string().datetime().optional(),
  allowReshare: z.boolean().optional(),
});

export const RevokeShareSchema = z.object({
  shareId: z.string().min(1),
});

// ── Continuity Session schemas ───────────────────────────────────────

export const CreateContinuitySessionSchema = z.object({
  name: z.string().min(1).max(200),
  initialContext: z.record(z.unknown()).optional(),
});

export const UpdateContinuitySessionSchema = z.object({
  workingContext: z.record(z.unknown()).optional(),
  appendEpisodeId: z.string().optional(),
  status: z.enum(['active', 'suspended', 'completed']).optional(),
});
