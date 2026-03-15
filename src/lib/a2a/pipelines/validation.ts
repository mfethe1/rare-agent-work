/**
 * Agent Pipeline Composition — Zod Validation Schemas
 */

import { z } from 'zod';

// ──────────────────────────────────────────────
// Shared primitives
// ──────────────────────────────────────────────

const jsonSchemaObject = z.record(z.unknown()).optional();

const stageRetrySchema = z.object({
  max_attempts: z.number().int().min(1).max(5),
  backoff_seconds: z.number().min(1).max(300),
});

const pipelineStageSchema = z.object({
  stage_id: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/, 'stage_id must be lowercase alphanumeric with hyphens/underscores'),
  capability_id: z.string().min(1).max(128),
  version: z.string().max(32).optional(),
  agent_id: z.string().uuid().optional(),
  static_inputs: z.record(z.unknown()).optional(),
  field_map: z.record(z.string()).optional(),
  timeout_seconds: z.number().int().min(10).max(3600).optional(),
  continue_on_failure: z.boolean().optional(),
  retry: stageRetrySchema.optional(),
  description: z.string().max(500).optional(),
});

// ──────────────────────────────────────────────
// Pipeline CRUD
// ──────────────────────────────────────────────

export const pipelineCreateSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().min(1).max(2000),
  stages: z.array(pipelineStageSchema).min(1).max(20),
  input_schema: jsonSchemaObject,
  output_schema: jsonSchemaObject,
  tags: z.array(z.string().max(64)).max(10).optional(),
  is_public: z.boolean().optional(),
});
export type PipelineCreateInput = z.infer<typeof pipelineCreateSchema>;

export const pipelineUpdateSchema = z.object({
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  name: z.string().min(1).max(128).optional(),
  description: z.string().min(1).max(2000).optional(),
  tags: z.array(z.string().max(64)).max(10).optional(),
  is_public: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
export type PipelineUpdateInput = z.infer<typeof pipelineUpdateSchema>;

export const pipelineListSchema = z.object({
  owner_agent_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  tag: z.string().max(64).optional(),
  is_public: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export type PipelineListInput = z.infer<typeof pipelineListSchema>;

// ──────────────────────────────────────────────
// Pipeline Execution
// ──────────────────────────────────────────────

export const pipelineExecuteSchema = z.object({
  input: z.record(z.unknown()),
  correlation_id: z.string().uuid().optional(),
});
export type PipelineExecuteInput = z.infer<typeof pipelineExecuteSchema>;

export const executionListSchema = z.object({
  pipeline_id: z.string().uuid().optional(),
  invoked_by_agent_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'partial', 'cancelled']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export type ExecutionListInput = z.infer<typeof executionListSchema>;

// ──────────────────────────────────────────────
// Pipeline Planning
// ──────────────────────────────────────────────

export const pipelinePlanSchema = z.object({
  input_schema: z.record(z.unknown()),
  desired_output_schema: z.record(z.unknown()),
  max_stages: z.number().int().min(1).max(10).optional(),
  min_confidence: z.number().min(0).max(1).optional(),
  preferred_capabilities: z.array(z.string().max(128)).max(10).optional(),
});
export type PipelinePlanInput = z.infer<typeof pipelinePlanSchema>;

// ──────────────────────────────────────────────
// Schema Compatibility Check
// ──────────────────────────────────────────────

export const schemaCheckSchema = z.object({
  source_capability_id: z.string().min(1).max(128),
  source_version: z.string().max(32).optional(),
  target_capability_id: z.string().min(1).max(128),
  target_version: z.string().max(32).optional(),
});
export type SchemaCheckInput = z.infer<typeof schemaCheckSchema>;
