/**
 * Agent Progressive Trust & Dynamic Autonomy Protocol — Validation
 *
 * Zod schemas for all trust protocol inputs.
 */

import { z } from 'zod';
import { TRUST_DOMAINS } from './types';

// ──────────────────────────────────────────────
// Shared Enums
// ──────────────────────────────────────────────

const trustDomainSchema = z.enum([
  'task_execution',
  'data_analysis',
  'code_generation',
  'financial_operations',
  'communication',
  'knowledge_management',
  'workflow_orchestration',
  'agent_coordination',
  'security_operations',
  'content_creation',
  'custom',
]);

const autonomyLevelSchema = z.enum([
  'observe',
  'suggest',
  'act_with_approval',
  'autonomous',
]);

// ──────────────────────────────────────────────
// Trust Signal (post-action evaluation)
// ──────────────────────────────────────────────

export const trustSignalSchema = z.object({
  agent_id: z.string().uuid(),
  domain: trustDomainSchema,
  success: z.boolean(),
  quality_rating: z.number().min(1).max(5).optional(),
  safety_violation: z.boolean().optional(),
  violation_description: z.string().max(500).optional(),
  task_id: z.string().uuid().optional(),
  duration_seconds: z.number().min(0).optional(),
});

export type TrustSignalInput = z.infer<typeof trustSignalSchema>;

// ──────────────────────────────────────────────
// Manual Override
// ──────────────────────────────────────────────

export const manualOverrideSchema = z.object({
  agent_id: z.string().uuid(),
  domain: trustDomainSchema,
  autonomy_level: autonomyLevelSchema,
  reason: z.string().min(10).max(500),
  override_by: z.string().min(1),
  duration_hours: z.number().min(1).max(8760).optional(), // max 1 year
});

export type ManualOverrideInput = z.infer<typeof manualOverrideSchema>;

// ──────────────────────────────────────────────
// Lift Override
// ──────────────────────────────────────────────

export const liftOverrideSchema = z.object({
  agent_id: z.string().uuid(),
  domain: trustDomainSchema,
  lifted_by: z.string().min(1),
  reason: z.string().min(10).max(500),
});

export type LiftOverrideInput = z.infer<typeof liftOverrideSchema>;

// ──────────────────────────────────────────────
// Threshold Adjustment
// ──────────────────────────────────────────────

export const thresholdAdjustmentSchema = z.object({
  agent_id: z.string().uuid(),
  domain: trustDomainSchema,
  thresholds: z.object({
    observe_to_suggest: z.number().min(0).max(1).optional(),
    suggest_to_act: z.number().min(0).max(1).optional(),
    act_to_autonomous: z.number().min(0).max(1).optional(),
    demotion_trigger: z.number().min(0).max(1).optional(),
    min_tasks_for_promotion: z.number().min(1).optional(),
    min_hours_at_level: z.number().min(0).optional(),
  }),
  adjusted_by: z.string().min(1),
});

export type ThresholdAdjustmentInput = z.infer<typeof thresholdAdjustmentSchema>;

// ──────────────────────────────────────────────
// Trust Profile Query
// ──────────────────────────────────────────────

export const trustProfileQuerySchema = z.object({
  include_events: z.boolean().optional(),
  event_limit: z.number().min(1).max(100).optional(),
  domain_filter: trustDomainSchema.optional(),
});

export type TrustProfileQuery = z.infer<typeof trustProfileQuerySchema>;

// ──────────────────────────────────────────────
// Trust History Query
// ──────────────────────────────────────────────

export const trustHistoryQuerySchema = z.object({
  domain: trustDomainSchema.optional(),
  event_type: z.string().optional(),
  limit: z.number().min(1).max(500).default(50),
  offset: z.number().min(0).default(0),
});

export type TrustHistoryQuery = z.infer<typeof trustHistoryQuerySchema>;

// ──────────────────────────────────────────────
// Batch Trust Signal
// ──────────────────────────────────────────────

export const batchTrustSignalSchema = z.object({
  signals: z.array(trustSignalSchema).min(1).max(100),
});

export type BatchTrustSignalInput = z.infer<typeof batchTrustSignalSchema>;

// ──────────────────────────────────────────────
// Domain Registration (for custom domains)
// ──────────────────────────────────────────────

export const customDomainSchema = z.object({
  label: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  high_stakes: z.boolean().default(false),
  custom_thresholds: z.object({
    observe_to_suggest: z.number().min(0).max(1),
    suggest_to_act: z.number().min(0).max(1),
    act_to_autonomous: z.number().min(0).max(1),
    demotion_trigger: z.number().min(0).max(1),
    min_tasks_for_promotion: z.number().min(1),
    min_hours_at_level: z.number().min(0),
  }).optional(),
});

export type CustomDomainInput = z.infer<typeof customDomainSchema>;
