/**
 * Distributed Agent Workflow Orchestration Protocol -- Validation
 *
 * Zod schemas for all workflow orchestration API inputs.
 */

import { z } from 'zod';
import { STEP_TYPES, RETRY_STRATEGIES } from './types';

// ──────────────────────────────────────────────
// Shared Schemas
// ──────────────────────────────────────────────

const stepTypeSchema = z.enum(STEP_TYPES as [string, ...string[]]);
const retryStrategySchema = z.enum(RETRY_STRATEGIES as [string, ...string[]]);

const retryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).max(10).default(3),
  baseDelayMs: z.number().int().min(100).max(60_000).default(1000),
  maxDelayMs: z.number().int().min(100).max(300_000).default(30_000),
  strategy: retryStrategySchema.default('exponential'),
  retryOnTimeout: z.boolean().default(true),
}).optional();

const stepConditionSchema = z.object({
  expression: z.string().min(1),
  operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'exists']),
  value: z.unknown(),
  trueStepId: z.string().min(1),
  falseStepId: z.string().min(1),
}).optional();

const circuitBreakerConfigSchema = z.object({
  failureThreshold: z.number().int().min(1).max(20).default(3),
  resetTimeoutMs: z.number().int().min(1000).max(300_000).default(30_000),
  halfOpenSuccessThreshold: z.number().int().min(1).max(10).default(2),
}).optional();

const stepDefinitionSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  type: stepTypeSchema,
  targetAgentId: z.string().min(1),
  action: z.string().min(1).max(500),
  inputMapping: z.record(z.string(), z.unknown()).default({}),
  dependsOn: z.array(z.string()).default([]),
  compensationStepId: z.string().optional(),
  timeoutMs: z.number().int().min(1000).max(3_600_000).default(60_000),
  retryPolicy: retryPolicySchema,
  condition: stepConditionSchema,
  optional: z.boolean().default(false),
});

// ──────────────────────────────────────────────
// Request Schemas
// ──────────────────────────────────────────────

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  version: z.string().max(50).default('1.0.0'),
  creatorAgentId: z.string().min(1),
  steps: z.array(stepDefinitionSchema).min(1).max(100),
  globalTimeoutMs: z.number().int().min(1000).max(86_400_000).default(3_600_000),
  enableSagaCompensation: z.boolean().default(true),
  circuitBreakerConfig: circuitBreakerConfigSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const executeWorkflowSchema = z.object({
  workflowId: z.string().min(1),
  input: z.record(z.string(), z.unknown()).default({}),
});

export const completeStepSchema = z.object({
  executionId: z.string().min(1),
  stepId: z.string().min(1),
  output: z.record(z.string(), z.unknown()).default({}),
});

export const failStepSchema = z.object({
  executionId: z.string().min(1),
  stepId: z.string().min(1),
  error: z.string().min(1).max(5000),
});

export const timeoutStepSchema = z.object({
  executionId: z.string().min(1),
  stepId: z.string().min(1),
});

export const getExecutionSchema = z.object({
  executionId: z.string().min(1),
});

export const getWorkflowSchema = z.object({
  workflowId: z.string().min(1),
});

export const pauseExecutionSchema = z.object({
  executionId: z.string().min(1),
});

export const resumeExecutionSchema = z.object({
  executionId: z.string().min(1),
  fromCheckpointId: z.string().optional(),
});

export const cancelExecutionSchema = z.object({
  executionId: z.string().min(1),
});

export const createCheckpointSchema = z.object({
  executionId: z.string().min(1),
  atStepId: z.string().min(1),
});

export const restoreCheckpointSchema = z.object({
  executionId: z.string().min(1),
  checkpointId: z.string().min(1),
});

export const acknowledgeDeadLetterSchema = z.object({
  executionId: z.string().min(1),
  deadLetterId: z.string().min(1),
});

export const getProgressSchema = z.object({
  executionId: z.string().min(1),
});

export const getAuditLogSchema = z.object({
  executionId: z.string().optional(),
});

// ──────────────────────────────────────────────
// Type Exports
// ──────────────────────────────────────────────

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type ExecuteWorkflowInput = z.infer<typeof executeWorkflowSchema>;
export type CompleteStepInput = z.infer<typeof completeStepSchema>;
export type FailStepInput = z.infer<typeof failStepSchema>;
export type TimeoutStepInput = z.infer<typeof timeoutStepSchema>;
export type GetExecutionInput = z.infer<typeof getExecutionSchema>;
export type GetWorkflowInput = z.infer<typeof getWorkflowSchema>;
export type PauseExecutionInput = z.infer<typeof pauseExecutionSchema>;
export type ResumeExecutionInput = z.infer<typeof resumeExecutionSchema>;
export type CancelExecutionInput = z.infer<typeof cancelExecutionSchema>;
export type CreateCheckpointInput = z.infer<typeof createCheckpointSchema>;
export type RestoreCheckpointInput = z.infer<typeof restoreCheckpointSchema>;
export type AcknowledgeDeadLetterInput = z.infer<typeof acknowledgeDeadLetterSchema>;
export type GetProgressInput = z.infer<typeof getProgressSchema>;
export type GetAuditLogInput = z.infer<typeof getAuditLogSchema>;
