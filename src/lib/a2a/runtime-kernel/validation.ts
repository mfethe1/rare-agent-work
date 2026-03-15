/**
 * A2A Runtime Kernel — Request Validation Schemas
 */

import { z } from 'zod';

const processStates = [
  'spawning', 'ready', 'running', 'suspended',
  'blocked', 'terminating', 'terminated', 'crashed',
] as const;

const processPriorities = ['critical', 'high', 'normal', 'low', 'idle'] as const;

const capabilityScopes = [
  'noosphere', 'world-model', 'metacognition', 'adversarial-resilience',
  'morphogenesis', 'temporal', 'cognition', 'knowledge', 'memory',
  'contracts', 'marketplace', 'governance', 'channels', 'mesh',
  'federation', 'swarm', 'evolution', 'simulation', 'observability',
  'sandbox', 'delegation', 'negotiation', 'consensus', 'auctions',
  'arbitration', 'skill-transfer', 'identity', 'trust', 'billing',
  'ipc', 'process-management', 'kernel-admin',
] as const;

const capabilityPermissions = ['read', 'write', 'execute', 'admin'] as const;

const ipcChannelTypes = ['pipe', 'message_queue', 'shared_memory', 'signal', 'broadcast'] as const;

// ── Process Management ──────────────────────────────────────────────────────

export const spawnProcessSchema = z.object({
  agentId: z.string().uuid(),
  name: z.string().min(1).max(256),
  priority: z.enum(processPriorities).optional(),
  parentPid: z.string().uuid().optional(),
  capabilities: z.array(z.object({
    scope: z.enum(capabilityScopes),
    permissions: z.array(z.enum(capabilityPermissions)).min(1),
  })).optional(),
  resourceQuota: z.object({
    maxCpuMs: z.number().positive().optional(),
    maxMemoryBytes: z.number().positive().optional(),
    maxIpcPerMinute: z.number().int().positive().optional(),
    maxChildProcesses: z.number().int().positive().optional(),
    maxConcurrentSyscalls: z.number().int().positive().optional(),
    maxTotalSyscalls: z.number().int().positive().optional(),
    maxApiCalls: z.number().int().positive().optional(),
    maxStorageBytes: z.number().positive().optional(),
  }).optional(),
  env: z.record(z.string()).optional(),
  labels: z.record(z.string()).optional(),
});

export const killProcessSchema = z.object({
  pid: z.string().uuid(),
  signal: z.enum(['SIGTERM', 'SIGKILL']),
  reason: z.string().min(1).max(500),
  callerPid: z.string().uuid(),
});

export const suspendProcessSchema = z.object({
  pid: z.string().uuid(),
  reason: z.string().min(1).max(500),
  callerPid: z.string().uuid(),
});

export const resumeProcessSchema = z.object({
  pid: z.string().uuid(),
  callerPid: z.string().uuid(),
});

export const listProcessesSchema = z.object({
  agentId: z.string().uuid().optional(),
  state: z.enum(processStates).optional(),
  priority: z.enum(processPriorities).optional(),
  parentPid: z.string().uuid().optional(),
  label: z.object({
    key: z.string(),
    value: z.string(),
  }).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

// ── IPC ─────────────────────────────────────────────────────────────────────

export const createIpcChannelSchema = z.object({
  ownerPid: z.string().uuid(),
  type: z.enum(ipcChannelTypes),
  readers: z.array(z.string().uuid()).min(1).max(100),
  writers: z.array(z.string().uuid()).min(1).max(100),
  bufferSize: z.number().int().min(1).max(100_000).optional(),
});

export const sendIpcMessageSchema = z.object({
  fromPid: z.string().uuid(),
  channelId: z.string().uuid(),
  tag: z.string().min(1).max(256),
  payload: z.unknown(),
  toPids: z.array(z.string().uuid()).optional(),
  requiresAck: z.boolean().optional(),
  correlationId: z.string().uuid().optional(),
  ttlMs: z.number().int().positive().max(3_600_000).optional(),
  priority: z.enum(processPriorities).optional(),
});

export const receiveIpcMessageSchema = z.object({
  pid: z.string().uuid(),
  channelId: z.string().uuid(),
  tagFilter: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

// ── Capabilities ────────────────────────────────────────────────────────────

export const requestCapabilitySchema = z.object({
  pid: z.string().uuid(),
  scope: z.enum(capabilityScopes),
  permissions: z.array(z.enum(capabilityPermissions)).min(1),
  reason: z.string().min(1).max(500),
  durationMs: z.number().int().positive().optional(),
});

// ── Subsystem ───────────────────────────────────────────────────────────────

export const registerSubsystemSchema = z.object({
  name: z.enum(capabilityScopes),
  description: z.string().min(1).max(1000),
  version: z.string().min(1).max(50),
  requiredCapabilities: z.array(z.enum(capabilityPermissions)),
  dependencies: z.array(z.enum(capabilityScopes)),
});

export const subsystemCallSchema = z.object({
  callerPid: z.string().uuid(),
  subsystem: z.enum(capabilityScopes),
  operation: z.string().min(1).max(256),
  args: z.record(z.unknown()),
});

// ── Scheduler ───────────────────────────────────────────────────────────────

export const configureSchedulerSchema = z.object({
  policy: z.enum(['fair_share', 'priority_preemptive', 'weighted_fair', 'deadline_driven', 'adaptive']).optional(),
  timeSliceMs: z.number().int().min(10).max(10_000).optional(),
  schedulingIntervalMs: z.number().int().min(10).max(5_000).optional(),
  maxReadyQueueSize: z.number().int().min(10).max(100_000).optional(),
  priorityInheritance: z.boolean().optional(),
  starvationThreshold: z.number().int().min(1).max(100).optional(),
  maxBlockedMs: z.number().int().min(1000).max(300_000).optional(),
});
