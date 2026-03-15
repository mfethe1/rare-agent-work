/**
 * Zod validation schemas for A2A protocol endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

// ──────────────────────────────────────────────
// Agent Registration — POST /api/a2a/agents
// ──────────────────────────────────────────────

const capabilitySchema = z.object({
  id: trimmed(128).min(1, 'Capability ID is required'),
  description: trimmed(500).min(1, 'Capability description is required'),
  input_modes: z.array(trimmed(64)).min(1).max(10).default(['application/json']),
  output_modes: z.array(trimmed(64)).min(1).max(10).default(['application/json']),
});

export const agentRegisterSchema = z.object({
  name: trimmed(200).min(1, 'Agent name is required'),
  description: trimmed(1000).min(1, 'Agent description is required'),
  callback_url: z.string().url().max(2000).optional(),
  capabilities: z.array(capabilitySchema).min(1, 'At least one capability is required').max(50),
});

export type AgentRegisterInput = z.infer<typeof agentRegisterSchema>;

// ──────────────────────────────────────────────
// Task Submission — POST /api/a2a/tasks
// ──────────────────────────────────────────────

export const taskSubmitSchema = z.object({
  intent: trimmed(128).min(1, 'Task intent is required'),
  input: z.record(z.string(), z.unknown()).default({}),
  target_agent_id: z.string().uuid().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  correlation_id: trimmed(256).optional(),
  ttl_seconds: z.number().int().min(10).max(86400).default(300),
});

export type TaskSubmitInput = z.infer<typeof taskSubmitSchema>;

// ──────────────────────────────────────────────
// Task Update — PATCH /api/a2a/tasks/:id
// ──────────────────────────────────────────────

/**
 * Valid status transitions an assigned agent can make.
 * Only forward transitions are allowed:
 *   accepted → in_progress
 *   accepted | in_progress → completed | failed
 */
const AGENT_SETTABLE_STATUSES = ['in_progress', 'completed', 'failed'] as const;

export const taskUpdateSchema = z.object({
  /** New status for the task. Only forward transitions allowed. */
  status: z.enum(AGENT_SETTABLE_STATUSES),
  /** Result payload — required when status is 'completed'. */
  result: z.record(z.string(), z.unknown()).optional(),
  /** Error details — required when status is 'failed'. */
  error: z.object({
    code: trimmed(128).min(1, 'Error code is required'),
    message: trimmed(2000).min(1, 'Error message is required'),
  }).optional(),
}).refine(
  (data) => {
    if (data.status === 'completed' && !data.result) return false;
    if (data.status === 'failed' && !data.error) return false;
    return true;
  },
  {
    message: 'Status "completed" requires a result object; status "failed" requires an error object.',
  },
);

export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

/** Map of valid status transitions for task updates. */
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  accepted: ['in_progress', 'completed', 'failed'],
  in_progress: ['completed', 'failed'],
};
