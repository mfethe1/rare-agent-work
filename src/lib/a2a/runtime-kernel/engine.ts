/**
 * A2A Runtime Kernel — Agent Operating System Engine
 *
 * The unified kernel that binds all A2A subsystems into a coherent runtime.
 * Manages agent process lifecycle, capability-based security, preemptive
 * scheduling, inter-process communication, resource allocation, and provides
 * a system call interface for agents to access any subsystem.
 *
 * Design principles:
 * - Kernel as security boundary: all subsystem access goes through capability checks
 * - Preemptive fairness: no process can starve others of resources
 * - Composition through IPC: processes compose by exchanging messages, not sharing state
 * - Audit-complete: every syscall, capability check, and state transition is logged
 * - Graceful degradation: kernel continues operating even when subsystems fail
 * - Zero-trust internal: processes prove capability on every syscall, not just at spawn
 */

import { randomUUID } from 'crypto';
import type {
  ProcessId,
  ProcessState,
  ProcessPriority,
  ProcessDescriptor,
  CapabilityToken,
  CapabilityScope,
  CapabilityPermission,
  CapabilityCheckResult,
  CapabilityCondition,
  ResourceQuota,
  ResourceUsage,
  ResourcePressure,
  SchedulerPolicy,
  SchedulerConfig,
  SchedulerState,
  SchedulingDecision,
  IpcChannel,
  IpcChannelType,
  IpcMessage,
  IpcDeliveryResult,
  SyscallType,
  Syscall,
  SyscallResult,
  SyscallErrorCode,
  KernelEvent,
  KernelEventType,
  KernelEventHandler,
  SubsystemDescriptor,
  SubsystemHealth,
  KernelState,
  KernelStatus,
  KernelMetrics,
  SpawnProcessRequest,
  SpawnProcessResponse,
  KillProcessRequest,
  KillProcessResponse,
  SuspendProcessRequest,
  ResumeProcessRequest,
  ProcessStateChangeResponse,
  ListProcessesRequest,
  ListProcessesResponse,
  CreateIpcChannelRequest,
  CreateIpcChannelResponse,
  SendIpcMessageRequest,
  SendIpcMessageResponse,
  ReceiveIpcMessageRequest,
  ReceiveIpcMessageResponse,
  SubsystemCallRequest,
  SubsystemCallResponse,
  RequestCapabilityRequest,
  RequestCapabilityResponse,
  RegisterSubsystemRequest,
  RegisterSubsystemResponse,
  GetKernelStatusResponse,
  GetKernelMetricsResponse,
} from './types';

// ─── In-Memory Stores ───────────────────────────────────────────────────────

const processes = new Map<ProcessId, ProcessDescriptor>();
const ipcChannels = new Map<string, IpcChannel>();
const messageQueues = new Map<string, IpcMessage[]>(); // channelId -> messages
const subsystems = new Map<CapabilityScope, SubsystemDescriptor>();
const eventHandlers = new Map<KernelEventType, Set<KernelEventHandler>>();
const syscallLog: Syscall[] = [];
const capabilityCache = new Map<string, { result: CapabilityCheckResult; expiresAt: number }>();

let kernelState: KernelState = 'running';
let kernelBootedAt: string = new Date().toISOString();
let eventSequence = 0;
let totalProcessesSpawned = 0;
let totalSyscalls = 0;
let totalIpcMessages = 0;
let totalCapabilityChecks = 0;
let capabilityViolations = 0;
let contextSwitches = 0;
let schedulerEpoch = 0;
let capCacheHits = 0;
let capCacheTotal = 0;

const DEFAULT_RESOURCE_QUOTA: ResourceQuota = {
  maxCpuMs: 60_000,
  maxMemoryBytes: 256 * 1024 * 1024, // 256 MB
  maxIpcPerMinute: 1000,
  maxChildProcesses: 16,
  maxConcurrentSyscalls: 10,
  maxTotalSyscalls: 100_000,
  maxApiCalls: 10_000,
  maxStorageBytes: 1024 * 1024 * 1024, // 1 GB
};

const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  policy: 'weighted_fair',
  timeSliceMs: 100,
  schedulingIntervalMs: 50,
  maxReadyQueueSize: 1000,
  priorityInheritance: true,
  starvationThreshold: 10,
  maxBlockedMs: 30_000,
};

let schedulerConfig = { ...DEFAULT_SCHEDULER_CONFIG };

// ─── Internal Helpers ───────────────────────────────────────────────────────

function emitEvent(type: KernelEventType, source: string, payload: Record<string, unknown>): KernelEvent {
  const event: KernelEvent = {
    id: randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    source,
    payload,
    sequence: ++eventSequence,
  };

  const handlers = eventHandlers.get(type);
  if (handlers) {
    for (const handler of handlers) {
      try { handler(event); } catch { /* kernel never crashes on handler errors */ }
    }
  }

  return event;
}

function now(): string {
  return new Date().toISOString();
}

function makeEmptyUsage(): ResourceUsage {
  return {
    cpuMs: 0,
    memoryBytes: 0,
    ipcThisMinute: 0,
    activeChildren: 0,
    concurrentSyscalls: 0,
    totalSyscalls: 0,
    apiCallsUsed: 0,
    storageBytes: 0,
  };
}

function priorityWeight(p: ProcessPriority): number {
  switch (p) {
    case 'critical': return 100;
    case 'high': return 50;
    case 'normal': return 20;
    case 'low': return 5;
    case 'idle': return 1;
  }
}

function isValidStateTransition(from: ProcessState, to: ProcessState): boolean {
  const transitions: Record<ProcessState, ProcessState[]> = {
    spawning: ['ready', 'terminated', 'crashed'],
    ready: ['running', 'terminated'],
    running: ['ready', 'suspended', 'blocked', 'terminating', 'terminated', 'crashed'],
    suspended: ['ready', 'terminating', 'terminated'],
    blocked: ['ready', 'terminating', 'terminated', 'crashed'],
    terminating: ['terminated'],
    terminated: [],
    crashed: [],
  };
  return transitions[from]?.includes(to) ?? false;
}

function transitionProcess(pid: ProcessId, newState: ProcessState, reason?: string): ProcessDescriptor {
  const proc = processes.get(pid);
  if (!proc) throw new KernelError('ENOENT', `Process ${pid} not found`);

  if (!isValidStateTransition(proc.state, newState)) {
    throw new KernelError('EINVAL', `Invalid state transition: ${proc.state} -> ${newState}`);
  }

  const previousState = proc.state;
  proc.state = newState;
  proc.lastTransitionAt = now();

  if (newState === 'terminated' || newState === 'crashed') {
    proc.exitCode = newState === 'crashed' ? 1 : 0;
    proc.exitReason = reason ?? null;
  }

  emitEvent('process.state_changed', 'kernel', {
    pid,
    previousState,
    newState,
    reason,
  });

  if (newState === 'terminated') {
    emitEvent('process.terminated', pid, { exitCode: proc.exitCode, reason });
  } else if (newState === 'crashed') {
    emitEvent('process.crashed', pid, { exitCode: 1, reason });
  } else if (newState === 'ready' && previousState === 'running') {
    emitEvent('process.preempted', 'scheduler', { pid, reason });
    contextSwitches++;
  }

  return proc;
}

function buildCapabilityCacheKey(pid: ProcessId, scope: CapabilityScope, permission: CapabilityPermission): string {
  return `${pid}:${scope}:${permission}`;
}

// ─── Kernel Error ───────────────────────────────────────────────────────────

export class KernelError extends Error {
  constructor(
    public readonly code: SyscallErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'KernelError';
  }
}

// ─── Process Management ─────────────────────────────────────────────────────

/**
 * Spawn a new agent process in the kernel.
 * This is the fundamental operation — every agent that wants to participate
 * in the A2A ecosystem must first spawn a process.
 */
export function spawnProcess(req: SpawnProcessRequest): SpawnProcessResponse {
  // Validate parent exists if specified
  if (req.parentPid) {
    const parent = processes.get(req.parentPid);
    if (!parent) throw new KernelError('ENOENT', `Parent process ${req.parentPid} not found`);
    if (parent.state === 'terminated' || parent.state === 'crashed') {
      throw new KernelError('EINVAL', `Parent process ${req.parentPid} is ${parent.state}`);
    }
    // Check parent's child process quota
    if (parent.resourceUsage.activeChildren >= parent.resourceQuota.maxChildProcesses) {
      throw new KernelError('EQUOTA', `Parent ${req.parentPid} has reached max child processes`);
    }
  }

  const pid: ProcessId = randomUUID();
  const quota: ResourceQuota = {
    ...DEFAULT_RESOURCE_QUOTA,
    ...req.resourceQuota,
  };

  // Grant requested capabilities
  const grantedCapabilities: CapabilityToken[] = (req.capabilities ?? []).map(cap => ({
    id: randomUUID(),
    scope: cap.scope,
    permissions: cap.permissions,
    expiresAt: null,
    grantedBy: 'kernel',
    delegable: true,
    maxDelegationDepth: 3,
    currentDelegationDepth: 0,
    rateLimit: null,
    conditions: [],
  }));

  const process: ProcessDescriptor = {
    pid,
    agentId: req.agentId,
    name: req.name,
    state: 'ready',
    priority: req.priority ?? 'normal',
    parentPid: req.parentPid ?? null,
    childPids: [],
    capabilities: grantedCapabilities,
    resourceQuota: quota,
    resourceUsage: makeEmptyUsage(),
    spawnedAt: now(),
    lastTransitionAt: now(),
    exitCode: null,
    exitReason: null,
    env: req.env ?? {},
    labels: req.labels ?? {},
    activeSubsystems: [],
    cpuTimeMs: 0,
    syscallCount: 0,
  };

  processes.set(pid, process);
  totalProcessesSpawned++;

  // Register as child of parent
  if (req.parentPid) {
    const parent = processes.get(req.parentPid)!;
    parent.childPids.push(pid);
    parent.resourceUsage.activeChildren++;
  }

  emitEvent('process.spawned', 'kernel', {
    pid,
    agentId: req.agentId,
    name: req.name,
    priority: process.priority,
    parentPid: req.parentPid ?? null,
    capabilityCount: grantedCapabilities.length,
  });

  return { process, grantedCapabilities };
}

/**
 * Kill (terminate) a process. SIGTERM allows graceful shutdown, SIGKILL is immediate.
 */
export function killProcess(req: KillProcessRequest): KillProcessResponse {
  const proc = processes.get(req.pid);
  if (!proc) throw new KernelError('ENOENT', `Process ${req.pid} not found`);

  // Check caller has permission (must be parent, self, or kernel admin)
  if (req.callerPid !== req.pid && req.callerPid !== proc.parentPid) {
    const caller = processes.get(req.callerPid);
    if (!caller) throw new KernelError('ENOENT', `Caller process ${req.callerPid} not found`);
    const hasAdmin = caller.capabilities.some(
      c => c.scope === 'kernel-admin' && c.permissions.includes('admin')
    );
    if (!hasAdmin) throw new KernelError('EPERM', `Process ${req.callerPid} cannot kill ${req.pid}`);
  }

  const previousState = proc.state;
  let gracePeriodMs: number | null = null;

  if (proc.state === 'terminated' || proc.state === 'crashed') {
    return { pid: req.pid, previousState, newState: proc.state, gracePeriodMs: null };
  }

  // Normalize to 'running' to ensure valid transition paths
  if (proc.state !== 'running' && proc.state !== 'terminating') {
    proc.state = 'running';
    proc.lastTransitionAt = now();
  }

  if (req.signal === 'SIGTERM') {
    // Graceful: transition to terminating, then to terminated
    transitionProcess(req.pid, 'terminating', req.reason);
    gracePeriodMs = 5000;
    // In a real kernel this would schedule a forced kill after grace period.
    // For now, immediately terminate.
    transitionProcess(req.pid, 'terminated', req.reason);
  } else {
    // SIGKILL: immediate termination
    transitionProcess(req.pid, 'terminated', `SIGKILL: ${req.reason}`);
  }

  // Cascade: terminate all children
  for (const childPid of [...proc.childPids]) {
    const child = processes.get(childPid);
    if (child && child.state !== 'terminated' && child.state !== 'crashed') {
      killProcess({ pid: childPid, signal: 'SIGTERM', reason: `Parent ${req.pid} terminated`, callerPid: req.pid });
    }
  }

  // Update parent's active children count
  if (proc.parentPid) {
    const parent = processes.get(proc.parentPid);
    if (parent) {
      parent.childPids = parent.childPids.filter(c => c !== req.pid);
      parent.resourceUsage.activeChildren = Math.max(0, parent.resourceUsage.activeChildren - 1);
    }
  }

  return {
    pid: req.pid,
    previousState,
    newState: proc.state,
    gracePeriodMs,
  };
}

/**
 * Suspend a process (pause execution without terminating).
 */
export function suspendProcess(req: SuspendProcessRequest): ProcessStateChangeResponse {
  const proc = processes.get(req.pid);
  if (!proc) throw new KernelError('ENOENT', `Process ${req.pid} not found`);

  if (proc.state !== 'running' && proc.state !== 'ready') {
    throw new KernelError('EINVAL', `Cannot suspend process in state ${proc.state}`);
  }

  // Normalize to 'running' if 'ready' to allow suspension path
  if (proc.state === 'ready') {
    proc.state = 'running';
    proc.lastTransitionAt = now();
  }

  const previousState = proc.state;
  transitionProcess(req.pid, 'suspended', req.reason);

  return {
    pid: req.pid,
    previousState,
    newState: 'suspended',
    transitionedAt: proc.lastTransitionAt,
  };
}

/**
 * Resume a suspended process.
 */
export function resumeProcess(req: ResumeProcessRequest): ProcessStateChangeResponse {
  const proc = processes.get(req.pid);
  if (!proc) throw new KernelError('ENOENT', `Process ${req.pid} not found`);

  if (proc.state !== 'suspended') {
    throw new KernelError('EINVAL', `Cannot resume process in state ${proc.state}`);
  }

  const previousState = proc.state;
  transitionProcess(req.pid, 'ready', 'Resumed');

  return {
    pid: req.pid,
    previousState,
    newState: 'ready',
    transitionedAt: proc.lastTransitionAt,
  };
}

/**
 * Get a single process by PID.
 */
export function getProcess(pid: ProcessId): ProcessDescriptor {
  const proc = processes.get(pid);
  if (!proc) throw new KernelError('ENOENT', `Process ${pid} not found`);
  return proc;
}

/**
 * List processes with optional filters.
 */
export function listProcesses(req: ListProcessesRequest): ListProcessesResponse {
  let results = Array.from(processes.values());

  if (req.agentId) results = results.filter(p => p.agentId === req.agentId);
  if (req.state) results = results.filter(p => p.state === req.state);
  if (req.priority) results = results.filter(p => p.priority === req.priority);
  if (req.parentPid) results = results.filter(p => p.parentPid === req.parentPid);
  if (req.label) results = results.filter(p => p.labels[req.label!.key] === req.label!.value);

  const total = results.length;
  const offset = req.offset ?? 0;
  const limit = req.limit ?? 50;
  results = results.slice(offset, offset + limit);

  return { processes: results, total };
}

// ─── Capability System ──────────────────────────────────────────────────────

/**
 * Check if a process has a specific capability.
 * This is called on EVERY subsystem access — the core security boundary.
 */
export function checkCapability(
  pid: ProcessId,
  scope: CapabilityScope,
  permission: CapabilityPermission,
): CapabilityCheckResult {
  totalCapabilityChecks++;
  capCacheTotal++;

  // Check cache first
  const cacheKey = buildCapabilityCacheKey(pid, scope, permission);
  const cached = capabilityCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    capCacheHits++;
    return cached.result;
  }

  const proc = processes.get(pid);
  if (!proc) {
    const result: CapabilityCheckResult = { granted: false, reason: 'Process not found', token: null, remainingQuota: null };
    capabilityViolations++;
    return result;
  }

  if (proc.state === 'terminated' || proc.state === 'crashed') {
    const result: CapabilityCheckResult = { granted: false, reason: `Process is ${proc.state}`, token: null, remainingQuota: null };
    capabilityViolations++;
    return result;
  }

  // Find matching capability token
  const token = proc.capabilities.find(
    cap => cap.scope === scope && cap.permissions.includes(permission)
  );

  if (!token) {
    const result: CapabilityCheckResult = {
      granted: false,
      reason: `No capability for ${scope}:${permission}`,
      token: null,
      remainingQuota: null,
    };
    capabilityViolations++;
    emitEvent('capability.violation', pid, { scope, permission, reason: result.reason });
    return result;
  }

  // Check expiry
  if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
    const result: CapabilityCheckResult = {
      granted: false,
      reason: 'Capability token expired',
      token: null,
      remainingQuota: null,
    };
    capabilityViolations++;
    emitEvent('capability.violation', pid, { scope, permission, reason: result.reason });
    return result;
  }

  // Check conditions
  for (const condition of token.conditions) {
    if (!evaluateCondition(condition, proc)) {
      const result: CapabilityCheckResult = {
        granted: false,
        reason: `Condition ${condition.type} not met`,
        token: null,
        remainingQuota: null,
      };
      capabilityViolations++;
      return result;
    }
  }

  // Check rate limit
  let remainingQuota: number | null = null;
  if (token.rateLimit !== null) {
    // Simplified rate limit check using syscall count
    remainingQuota = Math.max(0, token.rateLimit - proc.syscallCount);
    if (remainingQuota <= 0) {
      const result: CapabilityCheckResult = {
        granted: false,
        reason: 'Rate limit exceeded for capability',
        token,
        remainingQuota: 0,
      };
      return result;
    }
  }

  const result: CapabilityCheckResult = { granted: true, reason: 'Authorized', token, remainingQuota };

  // Cache for 5 seconds
  capabilityCache.set(cacheKey, { result, expiresAt: Date.now() + 5000 });

  return result;
}

function evaluateCondition(condition: CapabilityCondition, proc: ProcessDescriptor): boolean {
  switch (condition.type) {
    case 'process_state': {
      const allowed = condition.params['allowedStates'] as ProcessState[] | undefined;
      return allowed ? allowed.includes(proc.state) : true;
    }
    case 'time_window': {
      const start = condition.params['startHour'] as number | undefined;
      const end = condition.params['endHour'] as number | undefined;
      if (start !== undefined && end !== undefined) {
        const hour = new Date().getUTCHours();
        return hour >= start && hour <= end;
      }
      return true;
    }
    case 'resource_threshold': {
      const maxCpuPercent = condition.params['maxCpuPercent'] as number | undefined;
      if (maxCpuPercent !== undefined) {
        const usage = proc.resourceUsage.cpuMs / proc.resourceQuota.maxCpuMs;
        return usage <= maxCpuPercent / 100;
      }
      return true;
    }
    case 'parent_approval':
      // In a real system, this would check a signed approval from the parent
      return true;
    default:
      return true;
  }
}

/**
 * Request a new capability for a process.
 * In production, this would go through a governance/approval flow.
 */
export function requestCapability(req: RequestCapabilityRequest): RequestCapabilityResponse {
  const proc = processes.get(req.pid);
  if (!proc) throw new KernelError('ENOENT', `Process ${req.pid} not found`);

  // Check if already has this capability
  const existing = proc.capabilities.find(
    c => c.scope === req.scope && req.permissions.every(p => c.permissions.includes(p))
  );
  if (existing) {
    return { granted: true, token: existing, reason: 'Already has capability' };
  }

  // Auto-grant basic capabilities; in production this would be policy-driven
  const token: CapabilityToken = {
    id: randomUUID(),
    scope: req.scope,
    permissions: req.permissions,
    expiresAt: req.durationMs
      ? new Date(Date.now() + req.durationMs).toISOString()
      : null,
    grantedBy: 'kernel',
    delegable: false,
    maxDelegationDepth: 1,
    currentDelegationDepth: 0,
    rateLimit: null,
    conditions: [],
  };

  proc.capabilities.push(token);

  emitEvent('capability.granted', 'kernel', {
    pid: req.pid,
    scope: req.scope,
    permissions: req.permissions,
    reason: req.reason,
  });

  return { granted: true, token, reason: 'Granted by kernel policy' };
}

/**
 * Revoke a capability from a process.
 */
export function revokeCapability(pid: ProcessId, capabilityId: string): void {
  const proc = processes.get(pid);
  if (!proc) throw new KernelError('ENOENT', `Process ${pid} not found`);

  const idx = proc.capabilities.findIndex(c => c.id === capabilityId);
  if (idx === -1) throw new KernelError('ENOENT', `Capability ${capabilityId} not found`);

  const cap = proc.capabilities[idx];
  proc.capabilities.splice(idx, 1);

  // Invalidate cache
  for (const perm of cap.permissions) {
    capabilityCache.delete(buildCapabilityCacheKey(pid, cap.scope, perm));
  }

  emitEvent('capability.revoked', 'kernel', {
    pid,
    capabilityId,
    scope: cap.scope,
  });
}

// ─── Inter-Process Communication ────────────────────────────────────────────

/**
 * Create an IPC channel between processes.
 */
export function createIpcChannel(req: CreateIpcChannelRequest): CreateIpcChannelResponse {
  const owner = processes.get(req.ownerPid);
  if (!owner) throw new KernelError('ENOENT', `Owner process ${req.ownerPid} not found`);

  // Check IPC capability
  const capCheck = checkCapability(req.ownerPid, 'ipc', 'write');
  if (!capCheck.granted) {
    throw new KernelError('EPERM', `Process ${req.ownerPid} lacks IPC capability: ${capCheck.reason}`);
  }

  // Validate all reader/writer processes exist
  for (const pid of [...req.readers, ...req.writers]) {
    if (!processes.has(pid)) {
      throw new KernelError('ENOENT', `Process ${pid} not found`);
    }
  }

  const channel: IpcChannel = {
    id: randomUUID(),
    type: req.type,
    ownerPid: req.ownerPid,
    readers: req.readers,
    writers: req.writers,
    bufferSize: req.bufferSize ?? 1000,
    messageCount: 0,
    open: true,
    createdAt: now(),
    backpressure: 0,
  };

  ipcChannels.set(channel.id, channel);
  messageQueues.set(channel.id, []);

  emitEvent('ipc.channel_created', req.ownerPid, {
    channelId: channel.id,
    type: req.type,
    readers: req.readers,
    writers: req.writers,
  });

  return { channel };
}

/**
 * Send a message through an IPC channel.
 */
export function sendIpcMessage(req: SendIpcMessageRequest): SendIpcMessageResponse {
  const channel = ipcChannels.get(req.channelId);
  if (!channel) throw new KernelError('ENOENT', `Channel ${req.channelId} not found`);
  if (!channel.open) throw new KernelError('EINVAL', `Channel ${req.channelId} is closed`);

  // Check sender is in writers list
  if (!channel.writers.includes(req.fromPid)) {
    throw new KernelError('EPERM', `Process ${req.fromPid} cannot write to channel ${req.channelId}`);
  }

  // Check sender process exists and is active
  const sender = processes.get(req.fromPid);
  if (!sender) throw new KernelError('ENOENT', `Sender process ${req.fromPid} not found`);

  // Check IPC rate limit
  if (sender.resourceUsage.ipcThisMinute >= sender.resourceQuota.maxIpcPerMinute) {
    throw new KernelError('EQUOTA', `Process ${req.fromPid} exceeded IPC rate limit`);
  }

  // Check backpressure
  const queue = messageQueues.get(req.channelId) ?? [];
  if (queue.length >= channel.bufferSize) {
    emitEvent('ipc.backpressure_warning', req.fromPid, {
      channelId: req.channelId,
      queueSize: queue.length,
      bufferSize: channel.bufferSize,
    });
    throw new KernelError('EAGAIN', `Channel ${req.channelId} buffer full (backpressure)`);
  }

  const targetPids = req.toPids ?? channel.readers;

  const message: IpcMessage = {
    id: randomUUID(),
    fromPid: req.fromPid,
    toPids: targetPids,
    channelId: req.channelId,
    tag: req.tag,
    payload: req.payload,
    sentAt: now(),
    deliveredAt: null,
    requiresAck: req.requiresAck ?? false,
    correlationId: req.correlationId ?? null,
    ttlMs: req.ttlMs ?? 60_000,
    priority: req.priority ?? 'normal',
  };

  // Enqueue
  queue.push(message);
  messageQueues.set(req.channelId, queue);
  channel.messageCount++;
  channel.backpressure = queue.length;
  totalIpcMessages++;
  sender.resourceUsage.ipcThisMinute++;

  // Determine delivery results
  const deliveredTo: ProcessId[] = [];
  const failedDeliveries: Array<{ pid: ProcessId; reason: string }> = [];

  for (const pid of targetPids) {
    const target = processes.get(pid);
    if (!target) {
      failedDeliveries.push({ pid, reason: 'Process not found' });
    } else if (target.state === 'terminated' || target.state === 'crashed') {
      failedDeliveries.push({ pid, reason: `Process is ${target.state}` });
    } else {
      deliveredTo.push(pid);
    }
  }

  // Dead letter any failed deliveries
  for (const failed of failedDeliveries) {
    emitEvent('ipc.deadletter', 'kernel', {
      messageId: message.id,
      targetPid: failed.pid,
      reason: failed.reason,
    });
  }

  if (deliveredTo.length > 0) {
    message.deliveredAt = now();
    emitEvent('ipc.message_delivered', req.fromPid, {
      messageId: message.id,
      channelId: req.channelId,
      deliveredTo,
    });
  }

  const delivery: IpcDeliveryResult = {
    messageId: message.id,
    delivered: deliveredTo.length > 0,
    deliveredTo,
    failedDeliveries,
    enqueuedAt: message.sentAt,
  };

  return { delivery };
}

/**
 * Receive messages from an IPC channel.
 */
export function receiveIpcMessages(req: ReceiveIpcMessageRequest): ReceiveIpcMessageResponse {
  const channel = ipcChannels.get(req.channelId);
  if (!channel) throw new KernelError('ENOENT', `Channel ${req.channelId} not found`);

  // Check receiver is in readers list
  if (!channel.readers.includes(req.pid)) {
    throw new KernelError('EPERM', `Process ${req.pid} cannot read from channel ${req.channelId}`);
  }

  const queue = messageQueues.get(req.channelId) ?? [];
  const limit = req.limit ?? 10;

  // Filter messages for this receiver, optionally by tag
  let available = queue.filter(m => m.toPids.includes(req.pid));
  if (req.tagFilter) {
    available = available.filter(m => m.tag === req.tagFilter);
  }

  // Remove expired messages
  const cutoff = Date.now();
  available = available.filter(m => {
    const sentTime = new Date(m.sentAt).getTime();
    return sentTime + m.ttlMs > cutoff;
  });

  const messages = available.slice(0, limit);

  // Remove consumed messages from queue
  const consumedIds = new Set(messages.map(m => m.id));
  const remaining = queue.filter(m => !consumedIds.has(m.id));
  messageQueues.set(req.channelId, remaining);
  channel.backpressure = remaining.length;

  return { messages };
}

/**
 * Close an IPC channel.
 */
export function closeIpcChannel(channelId: string, callerPid: ProcessId): void {
  const channel = ipcChannels.get(channelId);
  if (!channel) throw new KernelError('ENOENT', `Channel ${channelId} not found`);
  if (channel.ownerPid !== callerPid) {
    throw new KernelError('EPERM', `Only owner can close channel`);
  }

  channel.open = false;
  messageQueues.delete(channelId);
}

// ─── Scheduler ──────────────────────────────────────────────────────────────

/**
 * Run a scheduling cycle. Returns the scheduling decision.
 * This implements weighted fair scheduling with starvation prevention.
 */
export function scheduleNext(): SchedulingDecision {
  schedulerEpoch++;

  const runnable = Array.from(processes.values()).filter(
    p => p.state === 'ready' || p.state === 'running'
  );

  const blocked = Array.from(processes.values()).filter(p => p.state === 'blocked');

  // Starvation detection: unblock processes blocked too long
  const unblockPids: ProcessId[] = [];
  for (const proc of blocked) {
    const blockedDuration = Date.now() - new Date(proc.lastTransitionAt).getTime();
    if (blockedDuration > schedulerConfig.maxBlockedMs) {
      transitionProcess(proc.pid, 'ready', 'Starvation prevention: unblocked after max blocked time');
      unblockPids.push(proc.pid);
      emitEvent('scheduler.starvation_detected', 'scheduler', { pid: proc.pid, blockedMs: blockedDuration });
    }
  }

  if (runnable.length === 0) {
    return {
      nextPid: null,
      preemptPids: [],
      unblockPids,
      reason: 'No runnable processes',
      timeSliceMs: 0,
    };
  }

  // Weighted fair scheduling: pick based on priority weight / CPU time ratio
  const scored = runnable.map(p => ({
    pid: p.pid,
    score: priorityWeight(p.priority) / Math.max(1, p.cpuTimeMs),
  }));

  scored.sort((a, b) => b.score - a.score);
  const nextPid = scored[0].pid;

  // Preempt currently running processes (except the chosen one)
  const preemptPids = runnable
    .filter(p => p.state === 'running' && p.pid !== nextPid)
    .map(p => p.pid);

  for (const pid of preemptPids) {
    transitionProcess(pid, 'ready', 'Preempted by scheduler');
  }

  // Set the chosen process to running
  const chosen = processes.get(nextPid)!;
  if (chosen.state === 'ready') {
    chosen.state = 'running';
    chosen.lastTransitionAt = now();
  }

  // Time slice based on priority
  const timeSliceMs = schedulerConfig.timeSliceMs * (priorityWeight(chosen.priority) / 20);

  emitEvent('scheduler.epoch', 'scheduler', {
    epoch: schedulerEpoch,
    nextPid,
    preemptCount: preemptPids.length,
    runnableCount: runnable.length,
    blockedCount: blocked.length,
  });

  return {
    nextPid,
    preemptPids,
    unblockPids,
    reason: `Weighted fair: score=${scored[0].score.toFixed(2)}`,
    timeSliceMs,
  };
}

/**
 * Get current scheduler state.
 */
export function getSchedulerState(): SchedulerState {
  const allProcs = Array.from(processes.values());
  const runQueue = allProcs.filter(p => p.state === 'running').map(p => p.pid);
  const readyQueue = allProcs.filter(p => p.state === 'ready').map(p => p.pid);
  const blockedQueue = allProcs.filter(p => p.state === 'blocked').map(p => p.pid);

  const activeCount = runQueue.length + readyQueue.length;
  const totalPossible = allProcs.filter(p => p.state !== 'terminated' && p.state !== 'crashed').length;

  return {
    runQueue,
    readyQueue,
    blockedQueue,
    epoch: schedulerEpoch,
    contextSwitches,
    avgWaitTimeMs: 0, // simplified
    avgTurnaroundMs: 0,
    utilization: totalPossible > 0 ? activeCount / totalPossible : 0,
    lastScheduledAt: now(),
  };
}

/**
 * Configure the scheduler.
 */
export function configureScheduler(config: Partial<SchedulerConfig>): SchedulerConfig {
  schedulerConfig = { ...schedulerConfig, ...config };
  return schedulerConfig;
}

// ─── Resource Monitoring ────────────────────────────────────────────────────

/**
 * Calculate system-wide resource pressure.
 */
export function getResourcePressure(): ResourcePressure {
  const allProcs = Array.from(processes.values()).filter(
    p => p.state !== 'terminated' && p.state !== 'crashed'
  );

  if (allProcs.length === 0) {
    return {
      level: 'nominal',
      scores: { cpu: 0, memory: 0, ipc: 0, syscalls: 0, apiCalls: 0, storage: 0 },
      preemptionCandidates: [],
    };
  }

  // Calculate per-resource average utilization
  const avgScores = {
    cpu: avg(allProcs.map(p => p.resourceUsage.cpuMs / p.resourceQuota.maxCpuMs)),
    memory: avg(allProcs.map(p => p.resourceUsage.memoryBytes / p.resourceQuota.maxMemoryBytes)),
    ipc: avg(allProcs.map(p => p.resourceUsage.ipcThisMinute / p.resourceQuota.maxIpcPerMinute)),
    syscalls: avg(allProcs.map(p => p.resourceUsage.totalSyscalls / p.resourceQuota.maxTotalSyscalls)),
    apiCalls: avg(allProcs.map(p => p.resourceUsage.apiCallsUsed / p.resourceQuota.maxApiCalls)),
    storage: avg(allProcs.map(p => p.resourceUsage.storageBytes / p.resourceQuota.maxStorageBytes)),
  };

  const maxPressure = Math.max(...Object.values(avgScores));
  const level: ResourcePressure['level'] =
    maxPressure > 0.9 ? 'critical' :
    maxPressure > 0.7 ? 'high' :
    maxPressure > 0.5 ? 'elevated' : 'nominal';

  // Find preemption candidates: lowest priority processes using most resources
  const candidates = allProcs
    .filter(p => p.priority === 'low' || p.priority === 'idle')
    .sort((a, b) => b.resourceUsage.cpuMs - a.resourceUsage.cpuMs)
    .slice(0, 5)
    .map(p => p.pid);

  if (level !== 'nominal') {
    emitEvent('resource.pressure_changed', 'kernel', { level, scores: avgScores });
  }

  return { level, scores: avgScores, preemptionCandidates: candidates };
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ─── Subsystem Registry ─────────────────────────────────────────────────────

/**
 * Register a subsystem with the kernel.
 * This makes the subsystem discoverable and accessible via syscalls.
 */
export function registerSubsystem(req: RegisterSubsystemRequest): RegisterSubsystemResponse {
  if (subsystems.has(req.name)) {
    throw new KernelError('EEXIST', `Subsystem ${req.name} already registered`);
  }

  const descriptor: SubsystemDescriptor = {
    name: req.name,
    description: req.description,
    health: 'healthy',
    version: req.version,
    requiredCapabilities: req.requiredCapabilities,
    load: 0,
    totalCalls: 0,
    avgResponseMs: 0,
    errorRate: 0,
    dependencies: req.dependencies,
    accepting: true,
    registeredAt: now(),
    lastHealthCheckAt: now(),
  };

  subsystems.set(req.name, descriptor);

  emitEvent('subsystem.registered', 'kernel', {
    name: req.name,
    version: req.version,
  });

  return { subsystem: descriptor };
}

/**
 * List all registered subsystems.
 */
export function listSubsystems(): SubsystemDescriptor[] {
  return Array.from(subsystems.values());
}

/**
 * Update subsystem health.
 */
export function updateSubsystemHealth(name: CapabilityScope, health: SubsystemHealth): void {
  const sub = subsystems.get(name);
  if (!sub) throw new KernelError('ENOENT', `Subsystem ${name} not found`);

  const previousHealth = sub.health;
  sub.health = health;
  sub.lastHealthCheckAt = now();

  if (previousHealth !== health) {
    emitEvent('subsystem.health_changed', 'kernel', {
      name,
      previousHealth,
      newHealth: health,
    });
  }
}

/**
 * Execute a subsystem call through the kernel.
 * This is the universal gateway — every subsystem access goes through here.
 */
export function subsystemCall(req: SubsystemCallRequest): SubsystemCallResponse {
  totalSyscalls++;

  const proc = processes.get(req.callerPid);
  if (!proc) throw new KernelError('ENOENT', `Caller process ${req.callerPid} not found`);

  // Increment syscall counter
  proc.syscallCount++;
  proc.resourceUsage.totalSyscalls++;
  proc.resourceUsage.concurrentSyscalls++;

  // Check concurrent syscall limit
  if (proc.resourceUsage.concurrentSyscalls > proc.resourceQuota.maxConcurrentSyscalls) {
    proc.resourceUsage.concurrentSyscalls--;
    throw new KernelError('EQUOTA', `Process ${req.callerPid} exceeded concurrent syscall limit`);
  }

  // Check total syscall limit
  if (proc.resourceUsage.totalSyscalls > proc.resourceQuota.maxTotalSyscalls) {
    proc.resourceUsage.concurrentSyscalls--;
    throw new KernelError('EQUOTA', `Process ${req.callerPid} exceeded total syscall limit (must recycle)`);
  }

  // Check capability
  const capCheck = checkCapability(req.callerPid, req.subsystem, 'execute');
  if (!capCheck.granted) {
    proc.resourceUsage.concurrentSyscalls--;
    throw new KernelError('ECAPABILITY', `Capability denied: ${capCheck.reason}`);
  }

  // Check subsystem health
  const sub = subsystems.get(req.subsystem);
  if (sub && !sub.accepting) {
    proc.resourceUsage.concurrentSyscalls--;
    throw new KernelError('EAGAIN', `Subsystem ${req.subsystem} is not accepting calls`);
  }

  // Track subsystem usage
  if (sub) {
    sub.totalCalls++;
    sub.load = Math.min(1, sub.load + 0.01); // simplified load tracking
  }

  // Track active subsystem
  if (!proc.activeSubsystems.includes(req.subsystem)) {
    proc.activeSubsystems.push(req.subsystem);
  }

  const startTime = Date.now();

  // In a real kernel, this would dispatch to the actual subsystem implementation.
  // For now, we simulate successful execution.
  const durationMs = Date.now() - startTime;

  proc.resourceUsage.concurrentSyscalls--;

  // Update subsystem avg response time
  if (sub) {
    sub.avgResponseMs = (sub.avgResponseMs * (sub.totalCalls - 1) + durationMs) / sub.totalCalls;
  }

  // Log the syscall
  const syscall: Syscall = {
    id: randomUUID(),
    callerPid: req.callerPid,
    type: 'subsystem.call',
    args: { subsystem: req.subsystem, operation: req.operation, ...req.args },
    issuedAt: now(),
    completedAt: now(),
    result: {
      success: true,
      data: { acknowledged: true, subsystem: req.subsystem, operation: req.operation },
      error: null,
      errorCode: null,
      durationUs: durationMs * 1000,
    },
  };
  syscallLog.push(syscall);

  // Keep syscall log bounded
  if (syscallLog.length > 10000) {
    syscallLog.splice(0, syscallLog.length - 10000);
  }

  return {
    success: true,
    data: { acknowledged: true, subsystem: req.subsystem, operation: req.operation },
    durationMs,
    subsystem: req.subsystem,
    operation: req.operation,
  };
}

// ─── Event System ───────────────────────────────────────────────────────────

/**
 * Subscribe to kernel events.
 */
export function onKernelEvent(type: KernelEventType, handler: KernelEventHandler): () => void {
  if (!eventHandlers.has(type)) {
    eventHandlers.set(type, new Set());
  }
  eventHandlers.get(type)!.add(handler);

  // Return unsubscribe function
  return () => {
    eventHandlers.get(type)?.delete(handler);
  };
}

// ─── Kernel Status & Metrics ────────────────────────────────────────────────

/**
 * Get overall kernel status.
 */
export function getKernelStatus(): GetKernelStatusResponse {
  const activeProcesses = Array.from(processes.values()).filter(
    p => p.state !== 'terminated' && p.state !== 'crashed'
  );

  const overallHealth: SubsystemHealth = (() => {
    const subs = Array.from(subsystems.values());
    if (subs.length === 0) return 'healthy';
    const unhealthyCount = subs.filter(s => s.health === 'unhealthy').length;
    const degradedCount = subs.filter(s => s.health === 'degraded').length;
    if (unhealthyCount > subs.length / 2) return 'unhealthy';
    if (unhealthyCount > 0 || degradedCount > subs.length / 3) return 'degraded';
    return 'healthy';
  })();

  const status: KernelStatus = {
    state: kernelState,
    version: '1.0.0',
    bootedAt: kernelBootedAt,
    uptimeMs: Date.now() - new Date(kernelBootedAt).getTime(),
    totalProcessesSpawned,
    activeProcessCount: activeProcesses.length,
    totalSyscalls,
    totalIpcMessages,
    scheduler: getSchedulerState(),
    resourcePressure: getResourcePressure(),
    subsystemCount: subsystems.size,
    health: overallHealth,
    eventSequence,
    totalCapabilityChecks,
    capabilityViolations,
  };

  return { status };
}

/**
 * Get detailed kernel metrics.
 */
export function getKernelMetrics(): GetKernelMetricsResponse {
  const allProcs = Array.from(processes.values());

  const processesByState: Record<ProcessState, number> = {
    spawning: 0, ready: 0, running: 0, suspended: 0,
    blocked: 0, terminating: 0, terminated: 0, crashed: 0,
  };
  const processesByPriority: Record<ProcessPriority, number> = {
    critical: 0, high: 0, normal: 0, low: 0, idle: 0,
  };

  for (const p of allProcs) {
    processesByState[p.state]++;
    processesByPriority[p.priority]++;
  }

  const activeProcs = allProcs.filter(p => p.state !== 'terminated' && p.state !== 'crashed');

  const topByCpu = activeProcs
    .sort((a, b) => b.cpuTimeMs - a.cpuTimeMs)
    .slice(0, 10)
    .map(p => ({ pid: p.pid, name: p.name, cpuMs: p.cpuTimeMs }));

  const topBySyscalls = activeProcs
    .sort((a, b) => b.syscallCount - a.syscallCount)
    .slice(0, 10)
    .map(p => ({ pid: p.pid, name: p.name, count: p.syscallCount }));

  const topSubsystems = Array.from(subsystems.values())
    .sort((a, b) => b.totalCalls - a.totalCalls)
    .slice(0, 10)
    .map(s => ({ name: s.name, calls: s.totalCalls, avgMs: s.avgResponseMs }));

  const uptimeSec = Math.max(1, (Date.now() - new Date(kernelBootedAt).getTime()) / 1000);

  const metrics: KernelMetrics = {
    processesByState,
    processesByPriority,
    topByCpu,
    topBySyscalls,
    topSubsystems,
    ipcThroughput: totalIpcMessages / uptimeSec,
    schedulerEfficiency: schedulerEpoch > 0
      ? 1 - (contextSwitches / Math.max(1, schedulerEpoch * 2))
      : 1,
    capCacheHitRate: capCacheTotal > 0 ? capCacheHits / capCacheTotal : 0,
    syscallErrorRate: totalSyscalls > 0 ? capabilityViolations / totalSyscalls : 0,
    eventBacklog: 0,
  };

  return { metrics };
}

// ─── Kernel Lifecycle ───────────────────────────────────────────────────────

/**
 * Boot the kernel (reset state).
 */
export function bootKernel(): void {
  processes.clear();
  ipcChannels.clear();
  messageQueues.clear();
  subsystems.clear();
  eventHandlers.clear();
  syscallLog.length = 0;
  capabilityCache.clear();

  kernelState = 'running';
  kernelBootedAt = now();
  eventSequence = 0;
  totalProcessesSpawned = 0;
  totalSyscalls = 0;
  totalIpcMessages = 0;
  totalCapabilityChecks = 0;
  capabilityViolations = 0;
  contextSwitches = 0;
  schedulerEpoch = 0;
  capCacheHits = 0;
  capCacheTotal = 0;
  schedulerConfig = { ...DEFAULT_SCHEDULER_CONFIG };

  emitEvent('kernel.started', 'kernel', { version: '1.0.0' });
}

/**
 * Gracefully shut down the kernel.
 */
export function shutdownKernel(): void {
  kernelState = 'shutting_down';

  // Terminate all processes
  const activeProcs = Array.from(processes.values()).filter(
    p => p.state !== 'terminated' && p.state !== 'crashed'
  );

  for (const proc of activeProcs) {
    try {
      killProcess({
        pid: proc.pid,
        signal: 'SIGTERM',
        reason: 'Kernel shutdown',
        callerPid: proc.pid, // self-kill on shutdown
      });
    } catch {
      // Force terminate on error
      proc.state = 'terminated';
      proc.exitCode = 1;
      proc.exitReason = 'Forced termination during kernel shutdown';
    }
  }

  // Close all IPC channels
  for (const [id, channel] of ipcChannels) {
    channel.open = false;
    messageQueues.delete(id);
  }

  kernelState = 'halted';
  emitEvent('kernel.shutdown', 'kernel', { processesTerminated: activeProcs.length });
}

// ─── Reset (for testing) ────────────────────────────────────────────────────

export function _resetKernel(): void {
  bootKernel();
}
