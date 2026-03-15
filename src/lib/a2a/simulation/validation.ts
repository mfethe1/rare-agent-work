/**
 * Zod validation schemas for Agent Digital Twin & Simulation endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

// ──────────────────────────────────────────────
// Shared enums
// ──────────────────────────────────────────────

const chaosEventTypeSchema = z.enum([
  'agent_failure',
  'latency_spike',
  'network_partition',
  'resource_exhaustion',
  'byzantine_fault',
  'cascade_trigger',
  'load_surge',
  'data_corruption',
]);

const playbookStepTypeSchema = z.enum([
  'submit_task',
  'broadcast_task',
  'send_message',
  'wait',
  'assert',
  'parallel_group',
]);

const assertionOpSchema = z.enum(['eq', 'neq', 'lt', 'lte', 'gt', 'gte']);

// ──────────────────────────────────────────────
// Twin Behavior Override
// ──────────────────────────────────────────────

const twinBehaviorOverrideSchema = z.object({
  capabilities: z.array(trimmed(256)).max(50).optional(),
  latency_mean_ms: z.number().min(0).max(300000).optional(),
  latency_stddev_ms: z.number().min(0).max(60000).optional(),
  failure_rate: z.number().min(0).max(1).optional(),
  failure_modes: z.record(z.string(), z.number().min(0).max(1)).optional(),
  cost_per_task: z.number().min(0).max(10000).optional(),
  max_concurrency: z.number().int().min(1).max(1000).optional(),
  response_templates: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

// ──────────────────────────────────────────────
// Chaos Events
// ──────────────────────────────────────────────

const chaosParametersSchema = z.object({
  latency_increase_ms: z.number().min(0).max(300000).optional(),
  partition_from_twin_ids: z.array(z.string().uuid()).max(50).optional(),
  byzantine_probability: z.number().min(0).max(1).optional(),
  load_multiplier: z.number().min(1).max(100).optional(),
  corruption_probability: z.number().min(0).max(1).optional(),
  cascade_twin_ids: z.array(z.string().uuid()).max(50).optional(),
  budget_consumed: z.number().min(0).max(1).optional(),
});

const chaosEventSchema = z.object({
  type: chaosEventTypeSchema,
  description: trimmed(1000).min(1, 'Description is required'),
  trigger_at_seconds: z.number().min(0).max(86400),
  duration_seconds: z.number().min(0).max(86400),
  target_twin_ids: z.array(z.string().uuid()).min(1, 'At least one target twin is required').max(50),
  parameters: chaosParametersSchema,
});

// ──────────────────────────────────────────────
// Playbook
// ──────────────────────────────────────────────

const playbookAssertionSchema = z.object({
  target: z.enum(['twin_status', 'task_count', 'message_count', 'total_cost', 'failure_count']),
  twin_id: z.string().uuid().optional(),
  op: assertionOpSchema,
  value: z.union([z.number(), z.string()]),
});

const playbookStepConfigSchema = z.object({
  sender_twin_id: z.string().uuid().optional(),
  target_twin_id: z.string().uuid().optional(),
  intent: trimmed(256).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  target_twin_ids: z.array(z.string().uuid()).max(50).optional(),
  message: trimmed(5000).optional(),
  wait_seconds: z.number().min(0).max(3600).optional(),
  assertion: playbookAssertionSchema.optional(),
});

const playbookStepSchema = z.object({
  type: playbookStepTypeSchema,
  description: trimmed(1000).min(1, 'Step description is required'),
  order: z.number().int().min(0).default(0),
  config: playbookStepConfigSchema,
});

const playbookSchema = z.object({
  name: trimmed(256).min(1, 'Playbook name is required'),
  steps: z.array(playbookStepSchema).min(1, 'At least one step is required').max(200),
});

// ──────────────────────────────────────────────
// Simulation Config
// ──────────────────────────────────────────────

const simulationConfigSchema = z.object({
  time_acceleration: z.number().min(1).max(1000).default(10),
  max_duration_seconds: z.number().int().min(10).max(86400).default(300),
  max_total_tasks: z.number().int().min(1).max(100000).default(10000),
  max_total_cost: z.number().min(0).max(1000000).default(10000),
  seed: z.number().int().optional(),
  capture_traces: z.boolean().default(true),
  stop_on_critical_failure: z.boolean().default(false),
});

// ──────────────────────────────────────────────
// Create Simulation — POST /api/a2a/simulations
// ──────────────────────────────────────────────

export const createSimulationSchema = z.object({
  name: trimmed(256).min(1, 'Simulation name is required'),
  description: trimmed(2000).min(1, 'Description is required'),
  source_agent_ids: z.array(z.string().uuid()).min(1, 'At least one source agent is required').max(100),
  twin_overrides: z.record(z.string(), twinBehaviorOverrideSchema).optional(),
  chaos_events: z.array(chaosEventSchema).max(100).optional(),
  playbook: playbookSchema,
  config: simulationConfigSchema.optional(),
  tags: z.array(trimmed(64)).max(20).optional(),
});

export type CreateSimulationInput = z.infer<typeof createSimulationSchema>;

// ──────────────────────────────────────────────
// List Simulations — GET /api/a2a/simulations
// ──────────────────────────────────────────────

export const listSimulationsSchema = z.object({
  status: z.enum(['draft', 'provisioning', 'ready', 'running', 'completed', 'failed', 'cancelled']).optional(),
  tag: trimmed(64).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type ListSimulationsInput = z.infer<typeof listSimulationsSchema>;

// ──────────────────────────────────────────────
// Compare Simulations — POST /api/a2a/simulations/compare
// ──────────────────────────────────────────────

export const compareSimulationsSchema = z.object({
  baseline_simulation_id: z.string().uuid('Baseline simulation ID must be a valid UUID'),
  candidate_simulation_id: z.string().uuid('Candidate simulation ID must be a valid UUID'),
  thresholds: z.record(z.string(), z.number().min(0).max(100)).optional(),
});

export type CompareSimulationsInput = z.infer<typeof compareSimulationsSchema>;

// ──────────────────────────────────────────────
// Replay Production Incident — POST /api/a2a/simulations/replay
// ──────────────────────────────────────────────

export const replaySimulationSchema = z.object({
  name: trimmed(256).min(1, 'Replay name is required'),
  source_agent_ids: z.array(z.string().uuid()).min(1, 'At least one source agent is required').max(100),
  replay_window: z.object({
    start: z.string().datetime({ message: 'Start must be a valid ISO-8601 timestamp' }),
    end: z.string().datetime({ message: 'End must be a valid ISO-8601 timestamp' }),
  }).refine(
    (w) => new Date(w.end).getTime() > new Date(w.start).getTime(),
    { message: 'End must be after start' },
  ),
  additional_chaos: z.array(chaosEventSchema).max(50).optional(),
  twin_overrides: z.record(z.string(), twinBehaviorOverrideSchema).optional(),
  tags: z.array(trimmed(64)).max(20).optional(),
});

export type ReplaySimulationInput = z.infer<typeof replaySimulationSchema>;
