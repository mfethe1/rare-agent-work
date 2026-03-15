/**
 * A2A Planner — Request Validation
 *
 * Zod schemas for validating planner API requests.
 */

import { z } from 'zod';

// ──────────────────────────────────────────────
// Goal Submission
// ──────────────────────────────────────────────

export const GoalConstraintsSchema = z.object({
  max_cost: z.number().min(0).optional(),
  max_latency_seconds: z.number().min(0).optional(),
  min_quality: z.number().min(0).max(1).optional(),
  required_agent_ids: z.array(z.string().uuid()).optional(),
  excluded_agent_ids: z.array(z.string().uuid()).optional(),
  required_capabilities: z.array(z.string().min(1)).optional(),
  require_approval: z.boolean().optional(),
  max_replan_attempts: z.number().int().min(0).max(10).optional(),
});

export const SubmitGoalSchema = z.object({
  requester_agent_id: z.string().uuid(),
  objective: z.string().min(5).max(2000),
  constraints: GoalConstraintsSchema.optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  priority: z.enum(['critical', 'high', 'normal', 'low']).optional(),
  strategy: z.enum([
    'balanced', 'minimize_cost', 'minimize_latency', 'maximize_quality', 'maximize_reliability',
  ]).optional(),
});

export type SubmitGoalRequest = z.infer<typeof SubmitGoalSchema>;

// ──────────────────────────────────────────────
// Plan Approval
// ──────────────────────────────────────────────

export const ApprovePlanSchema = z.object({
  plan_id: z.string().uuid(),
  approved: z.boolean(),
  /** If rejected, optionally provide feedback for re-planning. */
  feedback: z.string().max(500).optional(),
});

export type ApprovePlanRequest = z.infer<typeof ApprovePlanSchema>;

// ──────────────────────────────────────────────
// Step Completion / Failure
// ──────────────────────────────────────────────

export const CompleteStepSchema = z.object({
  plan_id: z.string().uuid(),
  step_id: z.string().uuid(),
  output: z.record(z.string(), z.unknown()),
});

export type CompleteStepRequest = z.infer<typeof CompleteStepSchema>;

export const FailStepSchema = z.object({
  plan_id: z.string().uuid(),
  step_id: z.string().uuid(),
  error: z.string().min(1).max(2000),
});

export type FailStepRequest = z.infer<typeof FailStepSchema>;

// ──────────────────────────────────────────────
// Re-plan Request
// ──────────────────────────────────────────────

export const ReplanSchema = z.object({
  plan_id: z.string().uuid(),
  reason: z.enum([
    'step_failed', 'cost_overrun', 'latency_overrun',
    'agent_unavailable', 'quality_below_threshold',
    'constraint_violation', 'manual',
  ]),
  description: z.string().min(1).max(1000),
  failed_step_id: z.string().uuid().optional(),
});

export type ReplanRequest = z.infer<typeof ReplanSchema>;
