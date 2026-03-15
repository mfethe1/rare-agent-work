/**
 * A2A Morphogenesis — Zod Validation Schemas
 */

import { z } from 'zod';

// ── Shared Enums ────────────────────────────────────────────────────────────

const morphOperationSchema = z.enum([
  'fusion', 'fission', 'graft', 'metamorphosis', 'replication',
]);

const fusionStrategySchema = z.enum(['symmetric', 'absorption', 'synthesis']);
const fissionStrategySchema = z.enum(['domain', 'complexity', 'modality', 'manual']);
const graftModeSchema = z.enum(['copy', 'transfer', 'mirror']);
const metamorphTriggerSchema = z.enum([
  'environmental', 'performance', 'directive', 'evolutionary', 'emergent',
]);
const metamorphPhaseSchema = z.enum([
  'chrysalis', 'transforming', 'stabilizing', 'emerged',
]);
const replicationVariationSchema = z.enum([
  'exact', 'drift', 'specialized', 'complementary',
]);

// ── Fusion ──────────────────────────────────────────────────────────────────

const fusionConfigSchema = z.object({
  strategy: fusionStrategySchema,
  composite_name: z.string().min(1).max(200),
  composite_description: z.string().min(1).max(2000),
  dominant_agent_id: z.string().uuid().optional(),
  merge_memory: z.boolean().default(true),
  trust_merge: z.enum(['average', 'minimum', 'maximum']).default('minimum'),
  exclude_capabilities: z.array(z.string()).optional(),
  ttl_seconds: z.number().int().min(0).max(86400 * 365).default(0),
});

export const proposeFusionSchema = z.object({
  agent_ids: z.array(z.string().uuid()).min(2).max(10),
  config: fusionConfigSchema,
  rationale: z.string().min(1).max(2000),
});

export const defuseSchema = z.object({
  composite_agent_id: z.string().uuid(),
  reason: z.string().min(1).max(2000),
});

// ── Fission ─────────────────────────────────────────────────────────────────

const fissionPartitionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  capability_ids: z.array(z.string()).min(1),
});

const fissionConfigSchema = z.object({
  strategy: fissionStrategySchema,
  target_count: z.number().int().min(2).max(20).optional(),
  partitions: z.array(fissionPartitionSchema).optional(),
  parent_as_coordinator: z.boolean().default(true),
  sub_agents_autonomous: z.boolean().default(false),
  ttl_seconds: z.number().int().min(0).max(86400 * 365).default(0),
});

export const proposeFissionSchema = z.object({
  agent_id: z.string().uuid(),
  config: fissionConfigSchema,
  rationale: z.string().min(1).max(2000),
});

export const reunifySchema = z.object({
  fission_event_id: z.string().uuid(),
  reason: z.string().min(1).max(2000),
});

// ── Graft ───────────────────────────────────────────────────────────────────

const graftConfigSchema = z.object({
  capability_id: z.string().min(1),
  donor_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  mode: graftModeSchema,
  ttl_seconds: z.number().int().min(60).max(86400 * 30), // 1 min – 30 days
  revocable: z.boolean().default(true),
  max_invocations: z.number().int().min(1).optional(),
  required_trust: z.enum(['untrusted', 'verified', 'partner']).default('verified'),
});

export const proposeGraftSchema = z.object({
  config: graftConfigSchema,
  rationale: z.string().min(1).max(2000),
});

export const revokeGraftSchema = z.object({
  graft_id: z.string().uuid(),
  reason: z.string().min(1).max(2000),
});

// ── Metamorphosis ───────────────────────────────────────────────────────────

const metamorphNewCapabilitySchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(2000),
  input_modes: z.array(z.string()).min(1),
  output_modes: z.array(z.string()).min(1),
  seed_config: z.record(z.string(), z.unknown()).optional(),
});

const metamorphEnhancementSchema = z.object({
  capability_id: z.string().min(1),
  enhancement: z.string().min(1).max(2000),
  add_input_modes: z.array(z.string()).optional(),
  add_output_modes: z.array(z.string()).optional(),
});

const metamorphConfigSchema = z.object({
  trigger: metamorphTriggerSchema,
  shed_capabilities: z.array(z.string()),
  new_capabilities: z.array(metamorphNewCapabilitySchema),
  enhance_capabilities: z.array(metamorphEnhancementSchema).optional(),
  max_chrysalis_seconds: z.number().int().min(10).max(86400).default(3600),
  preserve_memory: z.boolean().default(true),
  broadcast_transformation: z.boolean().default(true),
});

export const proposeMetamorphSchema = z.object({
  agent_id: z.string().uuid(),
  config: metamorphConfigSchema,
  rationale: z.string().min(1).max(2000),
});

export const advanceMetamorphSchema = z.object({
  agent_id: z.string().uuid(),
  phase: metamorphPhaseSchema,
  progress: z.number().min(0).max(100).optional(),
});

// ── Replication ─────────────────────────────────────────────────────────────

const replicationConfigSchema = z.object({
  count: z.number().int().min(1).max(50),
  variation: replicationVariationSchema,
  specializations: z.array(z.array(z.string())).optional(),
  drift_magnitude: z.number().min(0).max(1).optional(),
  shared_memory: z.boolean().default(false),
  ttl_seconds: z.number().int().min(0).max(86400 * 30).default(3600),
  allow_nested_replication: z.boolean().default(false),
  max_lineage_size: z.number().int().min(1).max(1000).default(100),
});

export const proposeReplicationSchema = z.object({
  agent_id: z.string().uuid(),
  config: replicationConfigSchema,
  rationale: z.string().min(1).max(2000),
});

// ── Consent ─────────────────────────────────────────────────────────────────

export const consentMorphSchema = z.object({
  event_id: z.string().uuid(),
  consent: z.boolean(),
  reason: z.string().max(2000).optional(),
});

// ── Rollback ────────────────────────────────────────────────────────────────

export const rollbackMorphSchema = z.object({
  event_id: z.string().uuid(),
  reason: z.string().min(1).max(2000),
});

// ── Lineage ─────────────────────────────────────────────────────────────────

export const morphLineageSchema = z.object({
  agent_id: z.string().uuid(),
  max_depth: z.number().int().min(1).max(50).default(10),
});

// ── Inferred Input Types ────────────────────────────────────────────────────

export type ProposeFusionInput = z.infer<typeof proposeFusionSchema>;
export type DefuseInput = z.infer<typeof defuseSchema>;
export type ProposeFissionInput = z.infer<typeof proposeFissionSchema>;
export type ReunifyInput = z.infer<typeof reunifySchema>;
export type ProposeGraftInput = z.infer<typeof proposeGraftSchema>;
export type RevokeGraftInput = z.infer<typeof revokeGraftSchema>;
export type ProposeMetamorphInput = z.infer<typeof proposeMetamorphSchema>;
export type AdvanceMetamorphInput = z.infer<typeof advanceMetamorphSchema>;
export type ProposeReplicationInput = z.infer<typeof proposeReplicationSchema>;
export type ConsentMorphInput = z.infer<typeof consentMorphSchema>;
export type RollbackMorphInput = z.infer<typeof rollbackMorphSchema>;
export type MorphLineageInput = z.infer<typeof morphLineageSchema>;
