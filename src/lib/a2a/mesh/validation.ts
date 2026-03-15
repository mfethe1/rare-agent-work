/**
 * Zod validation schemas for A2A Service Mesh endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

// ──────────────────────────────────────────────
// Mesh Route — POST /api/a2a/mesh/route
// ──────────────────────────────────────────────

export const meshRouteSchema = z.object({
  capability: trimmed(200).min(1, 'capability is required'),
  candidate_agent_ids: z.array(z.string().uuid()).min(1, 'At least one candidate required').max(50),
});

export type MeshRouteInput = z.infer<typeof meshRouteSchema>;

// ──────────────────────────────────────────────
// Create Mesh Policy — POST /api/a2a/mesh/policies
// ──────────────────────────────────────────────

const adaptiveWeightsSchema = z.object({
  latency: z.number().min(0).max(1).default(0.4),
  error_rate: z.number().min(0).max(1).default(0.35),
  load: z.number().min(0).max(1).default(0.25),
}).refine(
  (w) => Math.abs(w.latency + w.error_rate + w.load - 1) < 0.01,
  { message: 'Adaptive weights must sum to 1.0' },
);

const circuitBreakerConfigSchema = z.object({
  failure_threshold: z.number().int().min(1).max(100).default(5),
  recovery_threshold: z.number().int().min(1).max(50).default(3),
  open_duration_ms: z.number().int().min(1000).max(600_000).default(30_000),
  evaluation_window_ms: z.number().int().min(5000).max(600_000).default(60_000),
  failure_rate_threshold: z.number().min(0.01).max(1.0).default(0.5),
}).partial();

const retryPolicySchema = z.object({
  max_retries: z.number().int().min(0).max(10).default(3),
  initial_delay_ms: z.number().int().min(100).max(30_000).default(500),
  backoff_multiplier: z.number().min(1).max(5).default(2.0),
  max_delay_ms: z.number().int().min(500).max(60_000).default(10_000),
  jitter_factor: z.number().min(0).max(1).default(0.25),
  retryable_errors: z.array(trimmed(100)).default([]),
  non_retryable_errors: z.array(trimmed(100)).default([]),
}).partial();

const hedgingPolicySchema = z.object({
  enabled: z.boolean().default(false),
  max_parallel: z.number().int().min(2).max(5).default(2),
  hedge_delay_ms: z.number().int().min(100).max(10_000).default(500),
  latency_threshold_ms: z.number().int().min(100).max(60_000).default(2000),
}).partial();

export const meshPolicyCreateSchema = z.object({
  name: trimmed(200).min(1, 'name is required'),
  capability_pattern: trimmed(200).min(1, 'capability_pattern is required'),
  lb_strategy: z.enum([
    'weighted_round_robin',
    'least_connections',
    'latency_weighted',
    'adaptive',
  ]).default('adaptive'),
  adaptive_weights: adaptiveWeightsSchema.optional(),
  circuit_breaker_config: circuitBreakerConfigSchema.optional(),
  retry_policy: retryPolicySchema.optional(),
  hedging_policy: hedgingPolicySchema.optional(),
});

export type MeshPolicyCreateInput = z.infer<typeof meshPolicyCreateSchema>;

// ──────────────────────────────────────────────
// Update Mesh Policy — PATCH /api/a2a/mesh/policies/:id
// ──────────────────────────────────────────────

export const meshPolicyUpdateSchema = z.object({
  name: trimmed(200).optional(),
  lb_strategy: z.enum([
    'weighted_round_robin',
    'least_connections',
    'latency_weighted',
    'adaptive',
  ]).optional(),
  adaptive_weights: adaptiveWeightsSchema.optional(),
  circuit_breaker_config: circuitBreakerConfigSchema.optional(),
  retry_policy: retryPolicySchema.optional(),
  hedging_policy: hedgingPolicySchema.optional(),
  is_active: z.boolean().optional(),
});

export type MeshPolicyUpdateInput = z.infer<typeof meshPolicyUpdateSchema>;

// ──────────────────────────────────────────────
// Record Circuit Event — POST /api/a2a/mesh/circuit/:agentId/success|failure
// ──────────────────────────────────────────────

export const circuitEventSchema = z.object({
  agent_id: z.string().uuid('agent_id must be a UUID'),
});

export type CircuitEventInput = z.infer<typeof circuitEventSchema>;

// ──────────────────────────────────────────────
// Create Bulkhead — POST /api/a2a/mesh/bulkheads
// ──────────────────────────────────────────────

export const bulkheadCreateSchema = z.object({
  provider_agent_id: z.string().uuid(),
  consumer_agent_id: z.union([z.string().uuid(), z.literal('*')]),
  max_concurrent: z.number().int().min(1).max(1000).default(10),
  max_queue_size: z.number().int().min(0).max(10_000).default(50),
});

export type BulkheadCreateInput = z.infer<typeof bulkheadCreateSchema>;

// ──────────────────────────────────────────────
// Health Snapshots — POST /api/a2a/mesh/health/agents
// ──────────────────────────────────────────────

export const healthSnapshotSchema = z.object({
  agent_ids: z.array(z.string().uuid()).min(1).max(100),
});

export type HealthSnapshotInput = z.infer<typeof healthSnapshotSchema>;
