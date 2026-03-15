/**
 * A2A Runtime Kernel — Agent Operating System
 *
 * Public API for the Runtime Kernel subsystem. Provides the unified operating
 * system layer that binds all A2A subsystems into a coherent runtime with
 * process lifecycle management, capability-based security, preemptive
 * scheduling, inter-process communication, and resource governance.
 */

export {
  // Process management
  spawnProcess,
  killProcess,
  suspendProcess,
  resumeProcess,
  getProcess,
  listProcesses,
  // Capability system
  checkCapability,
  requestCapability,
  revokeCapability,
  // IPC
  createIpcChannel,
  sendIpcMessage,
  receiveIpcMessages,
  closeIpcChannel,
  // Scheduler
  scheduleNext,
  getSchedulerState,
  configureScheduler,
  // Resource monitoring
  getResourcePressure,
  // Subsystem registry
  registerSubsystem,
  listSubsystems,
  updateSubsystemHealth,
  subsystemCall,
  // Event system
  onKernelEvent,
  // Kernel lifecycle
  bootKernel,
  shutdownKernel,
  getKernelStatus,
  getKernelMetrics,
  // Error
  KernelError,
  // Testing
  _resetKernel,
} from './engine';

export type {
  // Process types
  ProcessId,
  ProcessState,
  ProcessPriority,
  ProcessDescriptor,
  // Capability types
  CapabilityToken,
  CapabilityScope,
  CapabilityPermission,
  CapabilityCheckResult,
  CapabilityCondition,
  // Resource types
  ResourceQuota,
  ResourceUsage,
  ResourcePressure,
  // Scheduler types
  SchedulerPolicy,
  SchedulerConfig,
  SchedulerState,
  SchedulingDecision,
  // IPC types
  IpcChannel,
  IpcChannelType,
  IpcMessage,
  IpcDeliveryResult,
  // Syscall types
  SyscallType,
  Syscall,
  SyscallResult,
  SyscallErrorCode,
  // Event types
  KernelEvent,
  KernelEventType,
  KernelEventHandler,
  // Subsystem types
  SubsystemDescriptor,
  SubsystemHealth,
  // Kernel types
  KernelState,
  KernelStatus,
  KernelMetrics,
  // Request/Response types
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
