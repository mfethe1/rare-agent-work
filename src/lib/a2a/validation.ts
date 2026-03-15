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

// ──────────────────────────────────────────────
// Context Store — POST /api/a2a/context
// ──────────────────────────────────────────────

export const contextStoreSchema = z.object({
  /** Logical namespace for partitioning. */
  namespace: trimmed(128).min(1).default('default'),
  /** Machine-readable key within the namespace. */
  key: trimmed(256).min(1, 'Context key is required'),
  /** Structured context payload. */
  value: z.record(z.string(), z.unknown()).refine(
    (v) => JSON.stringify(v).length <= 65536,
    { message: 'Context value must be under 64KB when serialized' },
  ),
  /** Optional: link to a task workflow. */
  correlation_id: trimmed(256).optional(),
  /** Optional: link to a specific task. */
  task_id: z.string().uuid().optional(),
  /** Content type hint. */
  content_type: trimmed(128).default('application/json'),
  /** TTL in seconds (1 minute to 7 days). */
  ttl_seconds: z.number().int().min(60).max(604800).default(3600),
});

export type ContextStoreInput = z.infer<typeof contextStoreSchema>;

// ──────────────────────────────────────────────
// Context Query — GET /api/a2a/context
// ──────────────────────────────────────────────

export const contextQuerySchema = z.object({
  /** Filter by namespace. */
  namespace: trimmed(128).optional(),
  /** Filter by correlation_id. */
  correlation_id: trimmed(256).optional(),
  /** Filter by task_id. */
  task_id: z.string().uuid().optional(),
  /** Filter by agent_id (defaults to all agents). */
  agent_id: z.string().uuid().optional(),
  /** Filter by key prefix. */
  key_prefix: trimmed(256).optional(),
  /** Max results (1-100). */
  limit: z.number().int().min(1).max(100).default(50),
});

export type ContextQueryInput = z.infer<typeof contextQuerySchema>;

// ──────────────────────────────────────────────
// Task Routing — POST /api/a2a/tasks/route
// ──────────────────────────────────────────────

export const taskRouteSchema = z.object({
  /** The capability or intent the task requires. */
  required_capability: trimmed(128).min(1, 'Required capability is required'),
  /** Structured input for the task. */
  input: z.record(z.string(), z.unknown()).default({}),
  /** Routing policy. */
  policy: z.enum(['best-match', 'round-robin', 'broadcast']).default('best-match'),
  /** Max agents to select (1-10). */
  max_targets: z.number().int().min(1).max(10).default(3),
  /** Task priority. */
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  /** Correlation ID for multi-step workflows. */
  correlation_id: trimmed(256).optional(),
  /** TTL in seconds (10s to 24h). */
  ttl_seconds: z.number().int().min(10).max(86400).default(300),
});

export type TaskRouteInput = z.infer<typeof taskRouteSchema>;

// ──────────────────────────────────────────────
// Task Feedback — POST /api/a2a/tasks/:id/feedback
// ──────────────────────────────────────────────

export const taskFeedbackSchema = z.object({
  /** Quality rating: 1=unusable, 2=poor, 3=acceptable, 4=good, 5=excellent. */
  rating: z.number().int().min(1).max(5),
  /** Optional structured feedback (e.g., latency, accuracy, format quality). */
  feedback: z.record(z.string(), z.unknown()).optional(),
});

export type TaskFeedbackInput = z.infer<typeof taskFeedbackSchema>;

// ──────────────────────────────────────────────
// Agent Discovery — GET /api/a2a/agents
// ──────────────────────────────────────────────

export const agentSearchSchema = z.object({
  /** Free-text search across agent name and description. */
  query: trimmed(200).optional(),
  /** Filter by capability ID (exact or domain-prefix match). */
  capability: trimmed(128).optional(),
  /** Filter by trust level(s). */
  trust_levels: z.array(z.enum(['untrusted', 'verified', 'partner'])).optional(),
  /** Filter by availability status(es). */
  availability: z.array(z.enum(['online', 'busy', 'idle', 'offline'])).optional(),
  /** Only return active agents (default: true). */
  active_only: z.boolean().default(true),
  /** Sort field. */
  sort_by: z.enum(['reputation', 'last_seen', 'name', 'created']).default('last_seen'),
  /** Sort direction. */
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  /** Pagination offset. */
  offset: z.number().int().min(0).default(0),
  /** Max results (1-100). */
  limit: z.number().int().min(1).max(100).default(20),
});

export type AgentSearchInput = z.infer<typeof agentSearchSchema>;

// ──────────────────────────────────────────────
// Agent Heartbeat — POST /api/a2a/agents/heartbeat
// ──────────────────────────────────────────────

export const agentHeartbeatSchema = z.object({
  /** Current load factor (0.0 = idle, 1.0 = at capacity). */
  load: z.number().min(0).max(1),
  /** Number of tasks currently being processed. */
  active_tasks: z.number().int().min(0).max(10000),
  /** Maximum concurrent tasks this agent can handle. */
  max_concurrent_tasks: z.number().int().min(1).max(10000),
  /** Optional free-form status message. */
  status_message: trimmed(500).optional(),
  /** Agent software version. */
  version: trimmed(64).optional(),
});

export type AgentHeartbeatInput = z.infer<typeof agentHeartbeatSchema>;

// ──────────────────────────────────────────────
// Agent Profile Update — PATCH /api/a2a/agents/profile
// ──────────────────────────────────────────────

export const agentProfileUpdateSchema = z.object({
  /** Updated description. */
  description: trimmed(1000).min(1).optional(),
  /** Updated callback URL (null to clear). */
  callback_url: z.union([z.string().url().max(2000), z.null()]).optional(),
  /** Updated capabilities list. */
  capabilities: z.array(capabilitySchema).min(1).max(50).optional(),
}).refine(
  (data) => data.description !== undefined || data.callback_url !== undefined || data.capabilities !== undefined,
  { message: 'At least one field must be provided for update.' },
);

export type AgentProfileUpdateInput = z.infer<typeof agentProfileUpdateSchema>;
