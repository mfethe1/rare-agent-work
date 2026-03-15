/**
 * A2A Gateway — Zod Validation Schemas
 */

import { z } from 'zod';

// ──────────────────────────────────────────────
// Batch Operations
// ──────────────────────────────────────────────

export const batchStepSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'Step ID must be alphanumeric with hyphens/underscores'),
  method: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']),
  path: z.string().min(1).max(512).startsWith('/'),
  body: z.record(z.unknown()).optional(),
  params: z.record(z.string()).optional(),
  depends_on: z.array(z.string().min(1).max(64)).optional(),
  optional: z.boolean().optional(),
  timeout_ms: z.number().int().min(100).max(60_000).optional(),
});

export const batchRequestSchema = z.object({
  steps: z.array(batchStepSchema).min(1).max(20),
  strategy: z.enum(['sequential', 'parallel']).optional(),
  timeout_ms: z.number().int().min(1000).max(120_000).optional(),
  correlation_id: z.string().max(128).optional(),
});

export type BatchStepInput = z.infer<typeof batchStepSchema>;
export type BatchRequestInput = z.infer<typeof batchRequestSchema>;

// ──────────────────────────────────────────────
// SSE Streaming
// ──────────────────────────────────────────────

export const streamEventTypes = [
  'connected',
  'task.progress',
  'task.completed',
  'task.failed',
  'agent.heartbeat',
  'workflow.step_completed',
  'workflow.completed',
  'platform.event',
  'ping',
  'error',
] as const;

export const streamSubscriptionSchema = z.object({
  events: z.array(z.enum(streamEventTypes)).optional(),
  task_id: z.string().uuid().optional(),
  workflow_id: z.string().uuid().optional(),
  agent_id: z.string().uuid().optional(),
  since: z.string().datetime().optional(),
});

export type StreamSubscriptionInput = z.infer<typeof streamSubscriptionSchema>;

// ──────────────────────────────────────────────
// Protocol Introspection
// ──────────────────────────────────────────────

export const introspectionQuerySchema = z.object({
  domain: z.string().max(64).optional(),
  tag: z.string().max(64).optional(),
  method: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']).optional(),
  requires_auth: z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : v),
    z.boolean().optional(),
  ),
  search: z.string().max(256).optional(),
  include_schemas: z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : v),
    z.boolean().optional(),
  ),
});

export type IntrospectionQueryInput = z.infer<typeof introspectionQuerySchema>;
