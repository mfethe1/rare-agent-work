/**
 * Zod validation schemas for Agent Governance endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

const autonomyLevelSchema = z.enum(['observe', 'suggest', 'act_with_approval', 'autonomous']);

const governedActionSchema = z.enum([
  'task.submit',
  'task.update',
  'context.store',
  'context.delete',
  'channel.create',
  'channel.message',
  'workflow.trigger',
  'contract.propose',
  'contract.negotiate',
  'contract.terminate',
  'agent.register',
]);

const timeWindowSchema = z.object({
  days_of_week: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  start_hour_utc: z.number().int().min(0).max(23),
  end_hour_utc: z.number().int().min(0).max(23),
});

const spendLimitSchema = z.object({
  max_daily_spend: z.number().min(0),
  max_per_action_spend: z.number().min(0),
  currency: trimmed(16).default('credits'),
});

// ──────────────────────────────────────────────
// Policy Create — POST /api/a2a/governance/policies
// ──────────────────────────────────────────────

export const policyCreateSchema = z.object({
  name: trimmed(256).min(1, 'Policy name is required'),
  description: trimmed(2000),
  agent_id: z.string().uuid('Agent ID must be a valid UUID'),
  autonomy_level: autonomyLevelSchema,
  allowed_actions: z.array(governedActionSchema).max(20).default([]),
  denied_actions: z.array(governedActionSchema).max(20).default([]),
  allowed_intents: z.array(trimmed(128)).max(50).default([]),
  denied_intents: z.array(trimmed(128)).max(50).default([]),
  allowed_targets: z.array(z.string().uuid()).max(100).default([]),
  denied_targets: z.array(z.string().uuid()).max(100).default([]),
  spend_limit: spendLimitSchema.optional(),
  time_windows: z.array(timeWindowSchema).max(10).default([]),
  escalation_target_id: z.string().uuid('Escalation target must be a valid UUID'),
  priority: z.number().int().min(0).max(1000).default(100),
});

export type PolicyCreateInput = z.infer<typeof policyCreateSchema>;

// ──────────────────────────────────────────────
// Policy List — GET /api/a2a/governance/policies
// ──────────────────────────────────────────────

export const policyListSchema = z.object({
  agent_id: z.string().uuid().optional(),
  is_active: z.boolean().default(true),
  limit: z.number().int().min(1).max(100).default(50),
});

export type PolicyListInput = z.infer<typeof policyListSchema>;

// ──────────────────────────────────────────────
// Evaluate Action — POST /api/a2a/governance/evaluate
// ──────────────────────────────────────────────

export const evaluateActionSchema = z.object({
  action: governedActionSchema,
  intent: trimmed(128).optional(),
  target_agent_id: z.string().uuid().optional(),
  estimated_cost: z.number().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type EvaluateActionInput = z.infer<typeof evaluateActionSchema>;

// ──────────────────────────────────────────────
// Resolve Escalation — POST /api/a2a/governance/escalations/:id/resolve
// ──────────────────────────────────────────────

export const escalationResolveSchema = z.object({
  decision: z.enum(['approved', 'denied']),
  rationale: trimmed(2000).optional(),
});

export type EscalationResolveInput = z.infer<typeof escalationResolveSchema>;

// ──────────────────────────────────────────────
// Audit Query — GET /api/a2a/governance/audit
// ──────────────────────────────────────────────

export const auditQuerySchema = z.object({
  agent_id: z.string().uuid().optional(),
  action: governedActionSchema.optional(),
  decision: z.enum(['allow', 'deny', 'escalate']).optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

export type AuditQueryInput = z.infer<typeof auditQuerySchema>;

// ──────────────────────────────────────────────
// Kill Switch — POST /api/a2a/governance/kill-switch
// ──────────────────────────────────────────────

export const killSwitchSchema = z.object({
  agent_id: z.string().uuid('Agent ID must be a valid UUID'),
  reason: trimmed(2000).min(1, 'Suspension reason is required'),
});

export type KillSwitchInput = z.infer<typeof killSwitchSchema>;

// ──────────────────────────────────────────────
// Lift Kill Switch — POST /api/a2a/governance/kill-switch/:id/lift
// ──────────────────────────────────────────────

export const killSwitchLiftSchema = z.object({
  reason: trimmed(2000).min(1, 'Lift reason is required'),
});

export type KillSwitchLiftInput = z.infer<typeof killSwitchLiftSchema>;
