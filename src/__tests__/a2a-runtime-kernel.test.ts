/**
 * A2A Runtime Kernel — Agent Operating System Tests
 *
 * Tests the unified kernel: process lifecycle, capability-based security,
 * preemptive scheduling, IPC, resource management, and subsystem registry.
 */

import {
  spawnProcess,
  killProcess,
  suspendProcess,
  resumeProcess,
  getProcess,
  listProcesses,
  checkCapability,
  requestCapability,
  revokeCapability,
  createIpcChannel,
  sendIpcMessage,
  receiveIpcMessages,
  closeIpcChannel,
  scheduleNext,
  getSchedulerState,
  configureScheduler,
  getResourcePressure,
  registerSubsystem,
  listSubsystems,
  updateSubsystemHealth,
  subsystemCall,
  onKernelEvent,
  bootKernel,
  shutdownKernel,
  getKernelStatus,
  getKernelMetrics,
  KernelError,
  _resetKernel,
} from '@/lib/a2a/runtime-kernel';

beforeEach(() => {
  _resetKernel();
});

// ─── Process Lifecycle ──────────────────────────────────────────────────────

describe('Process Management', () => {
  it('spawns a process with default resource quotas', () => {
    const result = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'test-agent',
    });

    expect(result.process.pid).toBeDefined();
    expect(result.process.state).toBe('ready');
    expect(result.process.name).toBe('test-agent');
    expect(result.process.priority).toBe('normal');
    expect(result.process.resourceQuota.maxCpuMs).toBe(60_000);
    expect(result.process.exitCode).toBeNull();
  });

  it('spawns a process with custom priority and capabilities', () => {
    const result = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'high-priority-agent',
      priority: 'critical',
      capabilities: [
        { scope: 'noosphere', permissions: ['read', 'execute'] },
        { scope: 'cognition', permissions: ['execute'] },
      ],
    });

    expect(result.process.priority).toBe('critical');
    expect(result.grantedCapabilities).toHaveLength(2);
    expect(result.grantedCapabilities[0].scope).toBe('noosphere');
    expect(result.grantedCapabilities[0].permissions).toEqual(['read', 'execute']);
  });

  it('spawns child processes linked to parent', () => {
    const parent = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'parent',
    });

    const child = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440001',
      name: 'child',
      parentPid: parent.process.pid,
    });

    expect(child.process.parentPid).toBe(parent.process.pid);
    const updatedParent = getProcess(parent.process.pid);
    expect(updatedParent.childPids).toContain(child.process.pid);
  });

  it('kills a process and cascades to children', () => {
    const parent = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'parent',
    });

    spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440001',
      name: 'child-1',
      parentPid: parent.process.pid,
    });

    spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440002',
      name: 'child-2',
      parentPid: parent.process.pid,
    });

    const result = killProcess({
      pid: parent.process.pid,
      signal: 'SIGTERM',
      reason: 'Test cleanup',
      callerPid: parent.process.pid,
    });

    expect(result.newState).toBe('terminated');

    // Children should also be terminated
    const listing = listProcesses({ state: 'terminated' });
    expect(listing.total).toBe(3);
  });

  it('suspends and resumes a process', () => {
    const proc = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'suspendable',
    });

    const suspended = suspendProcess({
      pid: proc.process.pid,
      reason: 'Pausing for resource conservation',
      callerPid: proc.process.pid,
    });

    expect(suspended.newState).toBe('suspended');

    const resumed = resumeProcess({
      pid: proc.process.pid,
      callerPid: proc.process.pid,
    });

    expect(resumed.newState).toBe('ready');
  });

  it('rejects invalid state transitions', () => {
    const proc = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'test',
    });

    killProcess({
      pid: proc.process.pid,
      signal: 'SIGTERM',
      reason: 'done',
      callerPid: proc.process.pid,
    });

    // Can't suspend a terminated process
    expect(() => suspendProcess({
      pid: proc.process.pid,
      reason: 'should fail',
      callerPid: proc.process.pid,
    })).toThrow(KernelError);
  });

  it('enforces child process quota', () => {
    const parent = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'parent',
      resourceQuota: { maxChildProcesses: 1 },
    });

    spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440001',
      name: 'child-1',
      parentPid: parent.process.pid,
    });

    expect(() => spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440002',
      name: 'child-2',
      parentPid: parent.process.pid,
    })).toThrow(/max child processes/);
  });

  it('lists processes with filters', () => {
    spawnProcess({ agentId: '550e8400-e29b-41d4-a716-446655440000', name: 'a', priority: 'high' });
    spawnProcess({ agentId: '550e8400-e29b-41d4-a716-446655440000', name: 'b', priority: 'low' });
    spawnProcess({ agentId: '550e8400-e29b-41d4-a716-446655440001', name: 'c', priority: 'high' });

    const highPriority = listProcesses({ priority: 'high' });
    expect(highPriority.total).toBe(2);

    const agentSpecific = listProcesses({ agentId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(agentSpecific.total).toBe(2);
  });
});

// ─── Capability System ──────────────────────────────────────────────────────

describe('Capability-Based Security', () => {
  it('grants and checks capabilities', () => {
    const proc = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'capable',
      capabilities: [
        { scope: 'noosphere', permissions: ['read', 'execute'] },
      ],
    });

    const check = checkCapability(proc.process.pid, 'noosphere', 'execute');
    expect(check.granted).toBe(true);
    expect(check.reason).toBe('Authorized');
  });

  it('denies access without capability', () => {
    const proc = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'limited',
    });

    const check = checkCapability(proc.process.pid, 'noosphere', 'execute');
    expect(check.granted).toBe(false);
    expect(check.reason).toContain('No capability');
  });

  it('dynamically requests capabilities', () => {
    const proc = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'requester',
    });

    // Initially denied
    expect(checkCapability(proc.process.pid, 'cognition', 'execute').granted).toBe(false);

    // Request capability
    const grant = requestCapability({
      pid: proc.process.pid,
      scope: 'cognition',
      permissions: ['execute'],
      reason: 'Need to reason',
    });

    expect(grant.granted).toBe(true);
    expect(grant.token).not.toBeNull();

    // Now authorized
    expect(checkCapability(proc.process.pid, 'cognition', 'execute').granted).toBe(true);
  });

  it('revokes capabilities', () => {
    const proc = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'revokable',
      capabilities: [{ scope: 'memory', permissions: ['read', 'write'] }],
    });

    const capId = proc.grantedCapabilities[0].id;
    expect(checkCapability(proc.process.pid, 'memory', 'read').granted).toBe(true);

    revokeCapability(proc.process.pid, capId);

    expect(checkCapability(proc.process.pid, 'memory', 'read').granted).toBe(false);
  });

  it('denies access for terminated processes', () => {
    const proc = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'doomed',
      capabilities: [{ scope: 'cognition', permissions: ['execute'] }],
    });

    killProcess({
      pid: proc.process.pid,
      signal: 'SIGKILL',
      reason: 'test',
      callerPid: proc.process.pid,
    });

    const check = checkCapability(proc.process.pid, 'cognition', 'execute');
    expect(check.granted).toBe(false);
  });
});

// ─── IPC ────────────────────────────────────────────────────────────────────

describe('Inter-Process Communication', () => {
  it('creates a channel and sends/receives messages', () => {
    const sender = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'sender',
      capabilities: [{ scope: 'ipc', permissions: ['write'] }],
    });
    const receiver = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440001',
      name: 'receiver',
      capabilities: [{ scope: 'ipc', permissions: ['read'] }],
    });

    const channel = createIpcChannel({
      ownerPid: sender.process.pid,
      type: 'message_queue',
      readers: [receiver.process.pid],
      writers: [sender.process.pid],
    });

    expect(channel.channel.open).toBe(true);

    const sendResult = sendIpcMessage({
      fromPid: sender.process.pid,
      channelId: channel.channel.id,
      tag: 'greeting',
      payload: { text: 'Hello from sender' },
    });

    expect(sendResult.delivery.delivered).toBe(true);
    expect(sendResult.delivery.deliveredTo).toContain(receiver.process.pid);

    const receiveResult = receiveIpcMessages({
      pid: receiver.process.pid,
      channelId: channel.channel.id,
    });

    expect(receiveResult.messages).toHaveLength(1);
    expect(receiveResult.messages[0].tag).toBe('greeting');
    expect(receiveResult.messages[0].payload).toEqual({ text: 'Hello from sender' });
  });

  it('enforces channel permissions', () => {
    const owner = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'owner',
      capabilities: [{ scope: 'ipc', permissions: ['write'] }],
    });
    const intruder = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440001',
      name: 'intruder',
    });

    const channel = createIpcChannel({
      ownerPid: owner.process.pid,
      type: 'pipe',
      readers: [owner.process.pid],
      writers: [owner.process.pid],
    });

    // Intruder can't write
    expect(() => sendIpcMessage({
      fromPid: intruder.process.pid,
      channelId: channel.channel.id,
      tag: 'hack',
      payload: {},
    })).toThrow(/cannot write/);

    // Intruder can't read
    expect(() => receiveIpcMessages({
      pid: intruder.process.pid,
      channelId: channel.channel.id,
    })).toThrow(/cannot read/);
  });

  it('handles backpressure', () => {
    const proc = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'spammer',
      capabilities: [{ scope: 'ipc', permissions: ['write'] }],
    });

    const channel = createIpcChannel({
      ownerPid: proc.process.pid,
      type: 'message_queue',
      readers: [proc.process.pid],
      writers: [proc.process.pid],
      bufferSize: 2,
    });

    sendIpcMessage({ fromPid: proc.process.pid, channelId: channel.channel.id, tag: 'a', payload: {} });
    sendIpcMessage({ fromPid: proc.process.pid, channelId: channel.channel.id, tag: 'b', payload: {} });

    expect(() => sendIpcMessage({
      fromPid: proc.process.pid, channelId: channel.channel.id, tag: 'c', payload: {},
    })).toThrow(/backpressure/);
  });

  it('closes channels', () => {
    const proc = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'closer',
      capabilities: [{ scope: 'ipc', permissions: ['write'] }],
    });

    const channel = createIpcChannel({
      ownerPid: proc.process.pid,
      type: 'pipe',
      readers: [proc.process.pid],
      writers: [proc.process.pid],
    });

    closeIpcChannel(channel.channel.id, proc.process.pid);

    expect(() => sendIpcMessage({
      fromPid: proc.process.pid,
      channelId: channel.channel.id,
      tag: 'test',
      payload: {},
    })).toThrow(/closed/);
  });
});

// ─── Scheduler ──────────────────────────────────────────────────────────────

describe('Scheduler', () => {
  it('schedules processes by weighted fair policy', () => {
    spawnProcess({ agentId: '550e8400-e29b-41d4-a716-446655440000', name: 'low-pri', priority: 'low' });
    const high = spawnProcess({ agentId: '550e8400-e29b-41d4-a716-446655440001', name: 'high-pri', priority: 'high' });

    const decision = scheduleNext();
    expect(decision.nextPid).toBe(high.process.pid);
    expect(decision.timeSliceMs).toBeGreaterThan(0);
  });

  it('returns null when no runnable processes', () => {
    const decision = scheduleNext();
    expect(decision.nextPid).toBeNull();
    expect(decision.reason).toContain('No runnable');
  });

  it('reports scheduler state', () => {
    spawnProcess({ agentId: '550e8400-e29b-41d4-a716-446655440000', name: 'a' });
    spawnProcess({ agentId: '550e8400-e29b-41d4-a716-446655440001', name: 'b' });

    const state = getSchedulerState();
    expect(state.readyQueue).toHaveLength(2);
    expect(state.epoch).toBe(0);
  });

  it('configures scheduler parameters', () => {
    const config = configureScheduler({ timeSliceMs: 200, policy: 'priority_preemptive' });
    expect(config.timeSliceMs).toBe(200);
    expect(config.policy).toBe('priority_preemptive');
  });
});

// ─── Subsystem Registry ─────────────────────────────────────────────────────

describe('Subsystem Registry', () => {
  it('registers and lists subsystems', () => {
    registerSubsystem({
      name: 'noosphere',
      description: 'Collective intelligence engine',
      version: '1.0.0',
      requiredCapabilities: ['execute'],
      dependencies: ['cognition'],
    });

    registerSubsystem({
      name: 'cognition',
      description: 'Core reasoning engine',
      version: '2.1.0',
      requiredCapabilities: ['execute'],
      dependencies: [],
    });

    const subs = listSubsystems();
    expect(subs).toHaveLength(2);
    expect(subs.find(s => s.name === 'noosphere')?.version).toBe('1.0.0');
  });

  it('prevents duplicate registration', () => {
    registerSubsystem({
      name: 'cognition',
      description: 'Core reasoning',
      version: '1.0.0',
      requiredCapabilities: ['execute'],
      dependencies: [],
    });

    expect(() => registerSubsystem({
      name: 'cognition',
      description: 'Duplicate',
      version: '1.0.0',
      requiredCapabilities: ['execute'],
      dependencies: [],
    })).toThrow(/already registered/);
  });

  it('updates subsystem health', () => {
    registerSubsystem({
      name: 'memory',
      description: 'Agent memory',
      version: '1.0.0',
      requiredCapabilities: ['read'],
      dependencies: [],
    });

    updateSubsystemHealth('memory', 'degraded');
    const subs = listSubsystems();
    expect(subs.find(s => s.name === 'memory')?.health).toBe('degraded');
  });

  it('executes subsystem calls with capability checks', () => {
    registerSubsystem({
      name: 'cognition',
      description: 'Core reasoning',
      version: '1.0.0',
      requiredCapabilities: ['execute'],
      dependencies: [],
    });

    const proc = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'caller',
      capabilities: [{ scope: 'cognition', permissions: ['execute'] }],
    });

    const result = subsystemCall({
      callerPid: proc.process.pid,
      subsystem: 'cognition',
      operation: 'reason',
      args: { query: 'What is 2+2?' },
    });

    expect(result.success).toBe(true);
    expect(result.subsystem).toBe('cognition');
  });

  it('denies subsystem call without capability', () => {
    registerSubsystem({
      name: 'governance',
      description: 'DAO governance',
      version: '1.0.0',
      requiredCapabilities: ['admin'],
      dependencies: [],
    });

    const proc = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'unauthorized',
    });

    expect(() => subsystemCall({
      callerPid: proc.process.pid,
      subsystem: 'governance',
      operation: 'vote',
      args: {},
    })).toThrow(KernelError);
  });
});

// ─── Kernel Events ──────────────────────────────────────────────────────────

describe('Kernel Event System', () => {
  it('subscribes to and receives events', () => {
    const events: string[] = [];
    const unsub = onKernelEvent('process.spawned', (e) => {
      events.push(e.payload['name'] as string);
    });

    spawnProcess({ agentId: '550e8400-e29b-41d4-a716-446655440000', name: 'test-1' });
    spawnProcess({ agentId: '550e8400-e29b-41d4-a716-446655440001', name: 'test-2' });

    expect(events).toEqual(['test-1', 'test-2']);

    unsub();
    spawnProcess({ agentId: '550e8400-e29b-41d4-a716-446655440002', name: 'test-3' });
    expect(events).toHaveLength(2); // unsubscribed, so no new event
  });
});

// ─── Resource Pressure ──────────────────────────────────────────────────────

describe('Resource Management', () => {
  it('reports nominal pressure with no processes', () => {
    const pressure = getResourcePressure();
    expect(pressure.level).toBe('nominal');
    expect(pressure.preemptionCandidates).toEqual([]);
  });

  it('reports pressure with active processes', () => {
    spawnProcess({ agentId: '550e8400-e29b-41d4-a716-446655440000', name: 'a' });
    const pressure = getResourcePressure();
    expect(pressure.level).toBe('nominal'); // fresh processes have zero usage
    expect(pressure.scores.cpu).toBe(0);
  });
});

// ─── Kernel Status & Metrics ────────────────────────────────────────────────

describe('Kernel Status & Metrics', () => {
  it('reports kernel status', () => {
    const { status } = getKernelStatus();
    expect(status.state).toBe('running');
    expect(status.version).toBe('1.0.0');
    expect(status.activeProcessCount).toBe(0);
    expect(status.totalSyscalls).toBe(0);
  });

  it('tracks metrics across operations', () => {
    spawnProcess({ agentId: '550e8400-e29b-41d4-a716-446655440000', name: 'a', priority: 'high' });
    spawnProcess({ agentId: '550e8400-e29b-41d4-a716-446655440001', name: 'b', priority: 'low' });

    const { metrics } = getKernelMetrics();
    expect(metrics.processesByPriority.high).toBe(1);
    expect(metrics.processesByPriority.low).toBe(1);
    expect(metrics.processesByState.ready).toBe(2);
  });

  it('tracks capability violations in metrics', () => {
    const proc = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'violator',
    });

    // Attempt unauthorized access
    checkCapability(proc.process.pid, 'kernel-admin', 'admin');

    const { status } = getKernelStatus();
    expect(status.capabilityViolations).toBeGreaterThan(0);
  });
});

// ─── Kernel Lifecycle ───────────────────────────────────────────────────────

describe('Kernel Lifecycle', () => {
  it('boots cleanly', () => {
    spawnProcess({ agentId: '550e8400-e29b-41d4-a716-446655440000', name: 'pre-boot' });
    expect(listProcesses({}).total).toBe(1);

    bootKernel();
    expect(listProcesses({}).total).toBe(0);
    expect(getKernelStatus().status.state).toBe('running');
  });

  it('shuts down gracefully', () => {
    spawnProcess({ agentId: '550e8400-e29b-41d4-a716-446655440000', name: 'a' });
    spawnProcess({ agentId: '550e8400-e29b-41d4-a716-446655440001', name: 'b' });

    shutdownKernel();

    const { status } = getKernelStatus();
    expect(status.state).toBe('halted');
    expect(status.activeProcessCount).toBe(0);
  });
});

// ─── Integration: Full Agent Lifecycle ──────────────────────────────────────

describe('Integration: Full Agent Lifecycle', () => {
  it('runs a complete agent lifecycle through the kernel', () => {
    // 1. Register subsystems
    registerSubsystem({
      name: 'noosphere',
      description: 'Collective intelligence',
      version: '1.0.0',
      requiredCapabilities: ['execute'],
      dependencies: [],
    });

    registerSubsystem({
      name: 'world-model',
      description: 'Environmental grounding',
      version: '1.0.0',
      requiredCapabilities: ['execute'],
      dependencies: [],
    });

    // 2. Spawn agent with capabilities
    const agent = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'full-lifecycle-agent',
      priority: 'high',
      capabilities: [
        { scope: 'noosphere', permissions: ['read', 'execute'] },
        { scope: 'world-model', permissions: ['execute'] },
        { scope: 'ipc', permissions: ['read', 'write'] },
      ],
      labels: { role: 'researcher', team: 'alpha' },
    });

    // 3. Schedule it
    const decision = scheduleNext();
    expect(decision.nextPid).toBe(agent.process.pid);

    // 4. Make subsystem calls
    const noosphereResult = subsystemCall({
      callerPid: agent.process.pid,
      subsystem: 'noosphere',
      operation: 'createSession',
      args: { goal: 'Test collective reasoning' },
    });
    expect(noosphereResult.success).toBe(true);

    // 5. Spawn a child worker
    const worker = spawnProcess({
      agentId: '550e8400-e29b-41d4-a716-446655440001',
      name: 'worker',
      parentPid: agent.process.pid,
      capabilities: [{ scope: 'ipc', permissions: ['read', 'write'] }],
    });

    // 6. IPC between parent and child
    const channel = createIpcChannel({
      ownerPid: agent.process.pid,
      type: 'message_queue',
      readers: [worker.process.pid],
      writers: [agent.process.pid],
    });

    sendIpcMessage({
      fromPid: agent.process.pid,
      channelId: channel.channel.id,
      tag: 'task',
      payload: { instruction: 'Analyze dataset' },
    });

    const received = receiveIpcMessages({
      pid: worker.process.pid,
      channelId: channel.channel.id,
    });
    expect(received.messages).toHaveLength(1);

    // 7. Check kernel metrics
    const { status } = getKernelStatus();
    expect(status.activeProcessCount).toBe(2);
    expect(status.totalSyscalls).toBeGreaterThan(0);
    expect(status.totalIpcMessages).toBe(1);

    // 8. Graceful shutdown
    killProcess({
      pid: agent.process.pid,
      signal: 'SIGTERM',
      reason: 'Task complete',
      callerPid: agent.process.pid,
    });

    // Worker should be cascaded
    const finalStatus = getKernelStatus();
    expect(finalStatus.status.activeProcessCount).toBe(0);
  });
});
