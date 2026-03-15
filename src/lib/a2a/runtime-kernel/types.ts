/**
 * A2A Runtime Kernel — Agent Operating System Types
 *
 * The critical missing layer for 2028: a unified runtime kernel that binds
 * all 46+ subsystems into a coherent operating system for autonomous agents.
 *
 * Why this matters (the council's critique):
 *
 * - **Elon Musk**: "You've built 46 brilliant subsystems and zero operating
 *   system. It's like having a graphics card, a network stack, a filesystem,
 *   and a scheduler — but no kernel. Every subsystem reinvents resource
 *   management, lifecycle hooks, and error propagation. In 2028, agents don't
 *   call libraries — they make system calls to a kernel that manages their
 *   entire existence. Without a kernel, your ecosystem is a parts catalog,
 *   not a running machine. SpaceX doesn't fly rockets by calling 46 separate
 *   APIs — there's a flight computer that orchestrates everything through
 *   a unified control plane."
 *
 * - **Satya Nadella**: "Windows didn't win because it had the best apps — it
 *   won because it provided a uniform abstraction layer that let apps compose.
 *   Your agent ecosystem has extraordinary capabilities but no composition
 *   primitive. An agent that wants to use morphogenesis, then noosphere, then
 *   world-model has to manually wire them together. Where's the kernel that
 *   lets an agent say 'I need capability X' and the runtime provides it?
 *   Where's the process model? Where's the scheduler that ensures fair
 *   resource access? You're building Azure for agents without building
 *   Windows for agents first."
 *
 * - **Demis Hassabis**: "AlphaFold didn't solve protein folding by having
 *   separate modules that couldn't share state. The architecture succeeded
 *   because information flowed through a unified trunk. Your 46 subsystems
 *   are 46 separate trunks. The kernel IS the trunk — the shared state bus,
 *   the lifecycle manager, the resource allocator that lets subsystems
 *   compose without knowing about each other. Without it, you can't build
 *   emergent behaviors that span subsystems."
 *
 * - **Geoffrey Hinton**: "The brain doesn't have 46 independent modules with
 *   separate APIs. It has a thalamic relay — a central routing kernel that
 *   manages attention, resource allocation, and inter-module communication.
 *   Your agents need a thalamus. A runtime kernel that decides which
 *   subsystems get compute cycles, which messages get priority, and which
 *   processes get preempted when resources are scarce."
 *
 * - **Sam Altman**: "The next platform shift isn't a smarter model — it's a
 *   smarter runtime. The agent OS is the next operating system. Whoever
 *   builds the kernel that makes agent composition as easy as function
 *   composition captures the entire ecosystem. Right now your agents are
 *   running on bare metal. Give them an OS."
 *
 * - **Dario Amodei**: "A kernel is also a security boundary. Right now, every
 *   subsystem does its own auth, its own resource limiting, its own sandboxing.
 *   That's 46 attack surfaces instead of one. A capability-based kernel means
 *   agents can only access subsystems they've been granted. Every system call
 *   is audited. Resource exhaustion in one process can't cascade. The kernel
 *   isn't just convenience — it's the security architecture."
 *
 * - **Matthew Berman**: "I've reviewed hundreds of agent frameworks. They all
 *   hit the same wall: composability. Tools work in isolation but fail when
 *   combined. The kernel pattern solves this by providing a process model
 *   where agents are first-class runtime entities with lifecycle, IPC, and
 *   resource guarantees. This is what separates a toy demo from a production
 *   agent platform."
 *
 * - **Wes Jones**: "In distributed systems, the hardest problem isn't the
 *   individual components — it's the glue. Your A2A ecosystem has world-class
 *   components and kindergarten-level glue. The runtime kernel IS the glue:
 *   process spawning, IPC channels, capability tokens, preemptive scheduling,
 *   and a unified event reactor. Without it, you're shipping a box of LEGO
 *   bricks without the baseplate."
 */

// ─── Process Model ──────────────────────────────────────────────────────────

/** Every agent running in the kernel is a Process */
export type ProcessId = string;

export type ProcessState =
  | 'spawning'      // being initialized
  | 'ready'         // waiting for scheduler
  | 'running'       // actively executing
  | 'suspended'     // voluntarily yielded or preempted
  | 'blocked'       // waiting on IPC or resource
  | 'terminating'   // graceful shutdown in progress
  | 'terminated'    // fully stopped
  | 'crashed';      // abnormal termination

export type ProcessPriority = 'critical' | 'high' | 'normal' | 'low' | 'idle';

export interface ProcessDescriptor {
  /** Unique process identifier */
  pid: ProcessId;
  /** The agent this process belongs to */
  agentId: string;
  /** Human-readable process name */
  name: string;
  /** Current process state */
  state: ProcessState;
  /** Scheduling priority */
  priority: ProcessPriority;
  /** Parent process (null for root processes) */
  parentPid: ProcessId | null;
  /** Child process IDs */
  childPids: ProcessId[];
  /** Capability tokens granted to this process */
  capabilities: CapabilityToken[];
  /** Resource quota for this process */
  resourceQuota: ResourceQuota;
  /** Current resource consumption */
  resourceUsage: ResourceUsage;
  /** Timestamp when process was spawned */
  spawnedAt: string;
  /** Timestamp of last state transition */
  lastTransitionAt: string;
  /** Exit code (only set when terminated/crashed) */
  exitCode: number | null;
  /** Exit reason */
  exitReason: string | null;
  /** Environment variables for this process */
  env: Record<string, string>;
  /** Process metadata/labels */
  labels: Record<string, string>;
  /** Which subsystems this process is currently using */
  activeSubsystems: string[];
  /** Accumulated CPU time in milliseconds */
  cpuTimeMs: number;
  /** Number of system calls made */
  syscallCount: number;
}

// ─── Capability-Based Security ──────────────────────────────────────────────

export type CapabilityScope =
  | 'noosphere'
  | 'world-model'
  | 'metacognition'
  | 'adversarial-resilience'
  | 'morphogenesis'
  | 'temporal'
  | 'cognition'
  | 'knowledge'
  | 'memory'
  | 'contracts'
  | 'marketplace'
  | 'governance'
  | 'channels'
  | 'mesh'
  | 'federation'
  | 'swarm'
  | 'evolution'
  | 'simulation'
  | 'observability'
  | 'sandbox'
  | 'delegation'
  | 'negotiation'
  | 'consensus'
  | 'auctions'
  | 'arbitration'
  | 'skill-transfer'
  | 'identity'
  | 'trust'
  | 'billing'
  | 'ipc'
  | 'process-management'
  | 'kernel-admin';

export type CapabilityPermission = 'read' | 'write' | 'execute' | 'admin';

export interface CapabilityToken {
  /** Unique token ID */
  id: string;
  /** Which subsystem this grants access to */
  scope: CapabilityScope;
  /** What operations are allowed */
  permissions: CapabilityPermission[];
  /** When this capability expires (ISO timestamp) */
  expiresAt: string | null;
  /** Who granted this capability */
  grantedBy: string;
  /** Whether this capability can be delegated to child processes */
  delegable: boolean;
  /** Maximum delegation depth */
  maxDelegationDepth: number;
  /** Current delegation depth */
  currentDelegationDepth: number;
  /** Rate limit for this capability (calls per minute) */
  rateLimit: number | null;
  /** Conditions under which this capability is valid */
  conditions: CapabilityCondition[];
}

export interface CapabilityCondition {
  /** Type of condition */
  type: 'time_window' | 'resource_threshold' | 'process_state' | 'parent_approval';
  /** Condition parameters */
  params: Record<string, unknown>;
}

export interface CapabilityCheckResult {
  granted: boolean;
  reason: string;
  token: CapabilityToken | null;
  remainingQuota: number | null;
}

// ─── Resource Management ────────────────────────────────────────────────────

export interface ResourceQuota {
  /** Maximum CPU time in milliseconds per scheduling epoch */
  maxCpuMs: number;
  /** Maximum memory in bytes */
  maxMemoryBytes: number;
  /** Maximum number of IPC messages per minute */
  maxIpcPerMinute: number;
  /** Maximum number of child processes */
  maxChildProcesses: number;
  /** Maximum number of concurrent subsystem calls */
  maxConcurrentSyscalls: number;
  /** Maximum total system calls before process must be recycled */
  maxTotalSyscalls: number;
  /** API call budget (for external AI model calls) */
  maxApiCalls: number;
  /** Storage quota in bytes */
  maxStorageBytes: number;
}

export interface ResourceUsage {
  /** CPU time consumed this epoch */
  cpuMs: number;
  /** Current memory usage */
  memoryBytes: number;
  /** IPC messages sent this minute */
  ipcThisMinute: number;
  /** Active child processes */
  activeChildren: number;
  /** In-flight syscalls */
  concurrentSyscalls: number;
  /** Total syscalls made */
  totalSyscalls: number;
  /** API calls consumed */
  apiCallsUsed: number;
  /** Storage consumed */
  storageBytes: number;
}

export interface ResourcePressure {
  /** Overall pressure level */
  level: 'nominal' | 'elevated' | 'high' | 'critical';
  /** Per-resource pressure scores (0.0 - 1.0) */
  scores: {
    cpu: number;
    memory: number;
    ipc: number;
    syscalls: number;
    apiCalls: number;
    storage: number;
  };
  /** Processes recommended for preemption */
  preemptionCandidates: ProcessId[];
}

// ─── Scheduler ──────────────────────────────────────────────────────────────

export type SchedulerPolicy =
  | 'fair_share'           // equal CPU time per process
  | 'priority_preemptive'  // higher priority preempts lower
  | 'weighted_fair'        // CPU time proportional to weight
  | 'deadline_driven'      // processes with deadlines get priority
  | 'adaptive';            // dynamically adjusts based on load

export interface SchedulerConfig {
  /** Scheduling policy */
  policy: SchedulerPolicy;
  /** Time slice per process in milliseconds */
  timeSliceMs: number;
  /** How often the scheduler runs (milliseconds) */
  schedulingIntervalMs: number;
  /** Maximum processes in ready queue */
  maxReadyQueueSize: number;
  /** Whether to allow priority inversion prevention */
  priorityInheritance: boolean;
  /** Starvation prevention: boost priority after N missed cycles */
  starvationThreshold: number;
  /** Maximum time a process can be blocked before forced preemption */
  maxBlockedMs: number;
}

export interface SchedulerState {
  /** Currently running processes */
  runQueue: ProcessId[];
  /** Processes waiting to run */
  readyQueue: ProcessId[];
  /** Blocked processes */
  blockedQueue: ProcessId[];
  /** Current scheduling epoch */
  epoch: number;
  /** Total context switches */
  contextSwitches: number;
  /** Average wait time (ms) */
  avgWaitTimeMs: number;
  /** Average turnaround time (ms) */
  avgTurnaroundMs: number;
  /** Scheduler utilization (0.0 - 1.0) */
  utilization: number;
  /** Timestamp of last scheduling decision */
  lastScheduledAt: string;
}

export interface SchedulingDecision {
  /** Process to run next */
  nextPid: ProcessId | null;
  /** Processes to preempt */
  preemptPids: ProcessId[];
  /** Processes to unblock */
  unblockPids: ProcessId[];
  /** Reason for this decision */
  reason: string;
  /** Time allocated to next process */
  timeSliceMs: number;
}

// ─── Inter-Process Communication (IPC) ──────────────────────────────────────

export type IpcChannelType =
  | 'pipe'           // unidirectional byte stream
  | 'message_queue'  // async message passing
  | 'shared_memory'  // shared memory region
  | 'signal'         // lightweight notification
  | 'broadcast';     // one-to-many

export interface IpcChannel {
  /** Channel identifier */
  id: string;
  /** Channel type */
  type: IpcChannelType;
  /** Creator process */
  ownerPid: ProcessId;
  /** Processes with read access */
  readers: ProcessId[];
  /** Processes with write access */
  writers: ProcessId[];
  /** Maximum buffer size */
  bufferSize: number;
  /** Current message count */
  messageCount: number;
  /** Whether the channel is open */
  open: boolean;
  /** Created timestamp */
  createdAt: string;
  /** Backpressure: messages waiting to be consumed */
  backpressure: number;
}

export interface IpcMessage {
  /** Message ID */
  id: string;
  /** Source process */
  fromPid: ProcessId;
  /** Target process(es) */
  toPids: ProcessId[];
  /** Channel this was sent on */
  channelId: string;
  /** Message type tag for pattern matching */
  tag: string;
  /** Payload */
  payload: unknown;
  /** Send timestamp */
  sentAt: string;
  /** Delivery timestamp */
  deliveredAt: string | null;
  /** Whether this requires acknowledgement */
  requiresAck: boolean;
  /** Correlation ID for request-response patterns */
  correlationId: string | null;
  /** TTL in milliseconds */
  ttlMs: number;
  /** Priority */
  priority: ProcessPriority;
}

export interface IpcDeliveryResult {
  messageId: string;
  delivered: boolean;
  deliveredTo: ProcessId[];
  failedDeliveries: Array<{ pid: ProcessId; reason: string }>;
  enqueuedAt: string;
}

// ─── System Calls ───────────────────────────────────────────────────────────

export type SyscallType =
  // Process management
  | 'process.spawn'
  | 'process.kill'
  | 'process.suspend'
  | 'process.resume'
  | 'process.info'
  | 'process.list'
  | 'process.wait'
  // IPC
  | 'ipc.create_channel'
  | 'ipc.send'
  | 'ipc.receive'
  | 'ipc.close_channel'
  | 'ipc.broadcast'
  // Capability
  | 'cap.request'
  | 'cap.revoke'
  | 'cap.delegate'
  | 'cap.check'
  // Resource
  | 'resource.query'
  | 'resource.request_increase'
  // Subsystem access
  | 'subsystem.call'
  | 'subsystem.list'
  | 'subsystem.health'
  // Kernel
  | 'kernel.status'
  | 'kernel.metrics'
  | 'kernel.configure';

export interface Syscall {
  /** Syscall ID */
  id: string;
  /** Calling process */
  callerPid: ProcessId;
  /** System call type */
  type: SyscallType;
  /** Arguments */
  args: Record<string, unknown>;
  /** Timestamp */
  issuedAt: string;
  /** Completed timestamp */
  completedAt: string | null;
  /** Result (null if pending) */
  result: SyscallResult | null;
}

export interface SyscallResult {
  /** Whether the syscall succeeded */
  success: boolean;
  /** Return value */
  data: unknown;
  /** Error message if failed */
  error: string | null;
  /** Error code */
  errorCode: SyscallErrorCode | null;
  /** Duration in microseconds */
  durationUs: number;
}

export type SyscallErrorCode =
  | 'EPERM'          // permission denied
  | 'ENOENT'         // process/channel not found
  | 'EAGAIN'         // resource temporarily unavailable
  | 'ENOMEM'         // out of memory quota
  | 'EBUSY'          // resource busy
  | 'EEXIST'         // already exists
  | 'EINVAL'         // invalid argument
  | 'ENOSYS'         // syscall not implemented
  | 'ETIMEDOUT'      // operation timed out
  | 'EQUOTA'         // quota exceeded
  | 'ECANCELED'      // operation canceled
  | 'EDEADLK'        // deadlock detected
  | 'ECAPABILITY';   // capability token invalid or expired

// ─── Kernel Event Bus ───────────────────────────────────────────────────────

export type KernelEventType =
  | 'process.spawned'
  | 'process.state_changed'
  | 'process.terminated'
  | 'process.crashed'
  | 'process.preempted'
  | 'scheduler.epoch'
  | 'scheduler.starvation_detected'
  | 'resource.pressure_changed'
  | 'resource.quota_exceeded'
  | 'capability.granted'
  | 'capability.revoked'
  | 'capability.violation'
  | 'ipc.channel_created'
  | 'ipc.message_delivered'
  | 'ipc.backpressure_warning'
  | 'ipc.deadletter'
  | 'kernel.started'
  | 'kernel.shutdown'
  | 'kernel.panic'
  | 'subsystem.registered'
  | 'subsystem.health_changed';

export interface KernelEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: KernelEventType;
  /** Timestamp */
  timestamp: string;
  /** Source (kernel, scheduler, process PID) */
  source: string;
  /** Event payload */
  payload: Record<string, unknown>;
  /** Sequence number for ordering */
  sequence: number;
}

export type KernelEventHandler = (event: KernelEvent) => void;

// ─── Subsystem Registry ─────────────────────────────────────────────────────

export type SubsystemHealth = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface SubsystemDescriptor {
  /** Subsystem name (matches CapabilityScope) */
  name: CapabilityScope;
  /** Human-readable description */
  description: string;
  /** Current health */
  health: SubsystemHealth;
  /** Version string */
  version: string;
  /** Required capabilities to access */
  requiredCapabilities: CapabilityPermission[];
  /** Current load (0.0 - 1.0) */
  load: number;
  /** Total calls served */
  totalCalls: number;
  /** Average response time in ms */
  avgResponseMs: number;
  /** Error rate (0.0 - 1.0) */
  errorRate: number;
  /** Dependencies on other subsystems */
  dependencies: CapabilityScope[];
  /** Whether this subsystem is currently accepting calls */
  accepting: boolean;
  /** Registered timestamp */
  registeredAt: string;
  /** Last health check timestamp */
  lastHealthCheckAt: string;
}

// ─── Kernel State ───────────────────────────────────────────────────────────

export type KernelState = 'booting' | 'running' | 'degraded' | 'shutting_down' | 'halted';

export interface KernelStatus {
  /** Kernel state */
  state: KernelState;
  /** Kernel version */
  version: string;
  /** Boot timestamp */
  bootedAt: string;
  /** Uptime in milliseconds */
  uptimeMs: number;
  /** Total processes spawned since boot */
  totalProcessesSpawned: number;
  /** Currently active processes */
  activeProcessCount: number;
  /** Total syscalls processed since boot */
  totalSyscalls: number;
  /** Total IPC messages routed */
  totalIpcMessages: number;
  /** Scheduler state */
  scheduler: SchedulerState;
  /** Resource pressure */
  resourcePressure: ResourcePressure;
  /** Registered subsystems count */
  subsystemCount: number;
  /** Overall system health */
  health: SubsystemHealth;
  /** Kernel event sequence counter */
  eventSequence: number;
  /** Total capability checks */
  totalCapabilityChecks: number;
  /** Capability violations */
  capabilityViolations: number;
}

export interface KernelMetrics {
  /** Processes by state */
  processesByState: Record<ProcessState, number>;
  /** Processes by priority */
  processesByPriority: Record<ProcessPriority, number>;
  /** Top processes by CPU time */
  topByCpu: Array<{ pid: ProcessId; name: string; cpuMs: number }>;
  /** Top processes by syscalls */
  topBySyscalls: Array<{ pid: ProcessId; name: string; count: number }>;
  /** Top subsystems by call count */
  topSubsystems: Array<{ name: string; calls: number; avgMs: number }>;
  /** IPC throughput (messages per second) */
  ipcThroughput: number;
  /** Scheduler efficiency (0.0 - 1.0) */
  schedulerEfficiency: number;
  /** Capability cache hit rate */
  capCacheHitRate: number;
  /** System call error rate */
  syscallErrorRate: number;
  /** Event bus backlog */
  eventBacklog: number;
}

// ─── Request / Response Types ───────────────────────────────────────────────

export interface SpawnProcessRequest {
  agentId: string;
  name: string;
  priority?: ProcessPriority;
  parentPid?: ProcessId;
  capabilities?: Array<{
    scope: CapabilityScope;
    permissions: CapabilityPermission[];
  }>;
  resourceQuota?: Partial<ResourceQuota>;
  env?: Record<string, string>;
  labels?: Record<string, string>;
}

export interface SpawnProcessResponse {
  process: ProcessDescriptor;
  grantedCapabilities: CapabilityToken[];
}

export interface KillProcessRequest {
  pid: ProcessId;
  signal: 'SIGTERM' | 'SIGKILL';
  reason: string;
  callerPid: ProcessId;
}

export interface KillProcessResponse {
  pid: ProcessId;
  previousState: ProcessState;
  newState: ProcessState;
  gracePeriodMs: number | null;
}

export interface SuspendProcessRequest {
  pid: ProcessId;
  reason: string;
  callerPid: ProcessId;
}

export interface ResumeProcessRequest {
  pid: ProcessId;
  callerPid: ProcessId;
}

export interface ProcessStateChangeResponse {
  pid: ProcessId;
  previousState: ProcessState;
  newState: ProcessState;
  transitionedAt: string;
}

export interface ListProcessesRequest {
  agentId?: string;
  state?: ProcessState;
  priority?: ProcessPriority;
  parentPid?: ProcessId;
  label?: { key: string; value: string };
  limit?: number;
  offset?: number;
}

export interface ListProcessesResponse {
  processes: ProcessDescriptor[];
  total: number;
}

export interface CreateIpcChannelRequest {
  ownerPid: ProcessId;
  type: IpcChannelType;
  readers: ProcessId[];
  writers: ProcessId[];
  bufferSize?: number;
}

export interface CreateIpcChannelResponse {
  channel: IpcChannel;
}

export interface SendIpcMessageRequest {
  fromPid: ProcessId;
  channelId: string;
  tag: string;
  payload: unknown;
  toPids?: ProcessId[];
  requiresAck?: boolean;
  correlationId?: string;
  ttlMs?: number;
  priority?: ProcessPriority;
}

export interface SendIpcMessageResponse {
  delivery: IpcDeliveryResult;
}

export interface ReceiveIpcMessageRequest {
  pid: ProcessId;
  channelId: string;
  tagFilter?: string;
  timeoutMs?: number;
  limit?: number;
}

export interface ReceiveIpcMessageResponse {
  messages: IpcMessage[];
}

export interface SubsystemCallRequest {
  callerPid: ProcessId;
  subsystem: CapabilityScope;
  operation: string;
  args: Record<string, unknown>;
}

export interface SubsystemCallResponse {
  success: boolean;
  data: unknown;
  durationMs: number;
  subsystem: CapabilityScope;
  operation: string;
}

export interface RequestCapabilityRequest {
  pid: ProcessId;
  scope: CapabilityScope;
  permissions: CapabilityPermission[];
  reason: string;
  durationMs?: number;
}

export interface RequestCapabilityResponse {
  granted: boolean;
  token: CapabilityToken | null;
  reason: string;
}

export interface RegisterSubsystemRequest {
  name: CapabilityScope;
  description: string;
  version: string;
  requiredCapabilities: CapabilityPermission[];
  dependencies: CapabilityScope[];
}

export interface RegisterSubsystemResponse {
  subsystem: SubsystemDescriptor;
}

export interface GetKernelStatusResponse {
  status: KernelStatus;
}

export interface GetKernelMetricsResponse {
  metrics: KernelMetrics;
}
