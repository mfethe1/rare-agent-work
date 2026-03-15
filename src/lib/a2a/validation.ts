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
