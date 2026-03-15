/**
 * Distributed Agent Workflow Orchestration Engine
 *
 * Core engine implementing DAG-based workflow execution with saga
 * compensation, circuit breakers, checkpointing, and distributed
 * transaction coordination across multiple agents.
 *
 * Architecture:
 *   WorkflowOrchestrationEngine (class with in-memory state)
 *     ├── Workflow CRUD (create, validate, get, list)
 *     ├── DAG validation (cycle detection, topological sort)
 *     ├── Execution management (start, pause, resume, cancel)
 *     ├── Step execution (advance, complete, fail, skip)
 *     ├── Saga compensation (reverse-order rollback)
 *     ├── Circuit breakers (per-agent fault isolation)
 *     ├── Checkpointing (persist & restore state)
 *     ├── Retry logic (fixed, exponential, linear backoff)
 *     ├── Dead letter queue (unrecoverable failures)
 *     └── Audit trail (full event history)
 */

import {
  type CircuitBreakerConfig,
  type CircuitBreakerState,
  type CircuitBreakerStatus,
  type CreateWorkflowRequest,
  type DAGValidationResult,
  type DeadLetterEntry,
  type RetryAttempt,
  type RetryPolicy,
  type StepStatus,
  type WorkflowAuditEntry,
  type WorkflowCheckpoint,
  type WorkflowDefinition,
  type WorkflowEventType,
  type WorkflowExecution,
  type WorkflowStatus,
  type WorkflowStepDefinition,
  type WorkflowStepExecution,
  TERMINAL_STEP_STATUSES,
  TERMINAL_WORKFLOW_STATUSES,
} from './types';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${ts}_${rand}`;
}

function now(): string {
  return new Date().toISOString();
}

// ──────────────────────────────────────────────
// Default Configs
// ──────────────────────────────────────────────

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
  halfOpenSuccessThreshold: 2,
};

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  strategy: 'exponential',
  retryOnTimeout: true,
};

const DEFAULT_GLOBAL_TIMEOUT_MS = 3600_000; // 1 hour

// ──────────────────────────────────────────────
// Workflow Orchestration Engine
// ──────────────────────────────────────────────

export class WorkflowOrchestrationEngine {
  /** All workflow definitions by ID */
  private definitions: Map<string, WorkflowDefinition> = new Map();
  /** All workflow executions by ID */
  private executions: Map<string, WorkflowExecution> = new Map();
  /** Audit trail */
  private auditLog: WorkflowAuditEntry[] = [];

  // ────────────────────────────────────────────
  // Workflow Definition CRUD
  // ────────────────────────────────────────────

  /**
   * Create a new workflow definition.
   * Validates the DAG structure before persisting.
   */
  createWorkflow(request: CreateWorkflowRequest): WorkflowDefinition {
    const id = generateId('wf');
    const timestamp = now();

    const cbConfig: CircuitBreakerConfig = {
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      ...(request.circuitBreakerConfig || {}),
    };

    const steps: WorkflowStepDefinition[] = request.steps.map(s => ({
      ...s,
      retryPolicy: s.retryPolicy || DEFAULT_RETRY_POLICY,
      timeoutMs: s.timeoutMs || 60_000,
      optional: s.optional ?? false,
      inputMapping: s.inputMapping || {},
      dependsOn: s.dependsOn || [],
      metadata: {},
    }));

    const definition: WorkflowDefinition = {
      id,
      name: request.name,
      description: request.description,
      version: request.version || '1.0.0',
      creatorAgentId: request.creatorAgentId,
      steps,
      globalTimeoutMs: request.globalTimeoutMs || DEFAULT_GLOBAL_TIMEOUT_MS,
      enableSagaCompensation: request.enableSagaCompensation ?? true,
      circuitBreakerConfig: cbConfig,
      metadata: request.metadata || {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Validate DAG before persisting
    const validation = this.validateDAG(definition);
    if (!validation.valid) {
      throw new Error(`Invalid workflow DAG: ${validation.errors.join('; ')}`);
    }

    this.definitions.set(id, definition);
    return definition;
  }

  /**
   * Get a workflow definition by ID.
   */
  getWorkflow(workflowId: string): WorkflowDefinition {
    const def = this.definitions.get(workflowId);
    if (!def) throw new Error(`Workflow not found: ${workflowId}`);
    return def;
  }

  /**
   * List all workflow definitions.
   */
  listWorkflows(): WorkflowDefinition[] {
    return Array.from(this.definitions.values());
  }

  // ────────────────────────────────────────────
  // DAG Validation
  // ────────────────────────────────────────────

  /**
   * Validate the workflow's DAG structure:
   * - No cycles (topological sort)
   * - All dependency references exist
   * - All compensation step references exist
   * - Decision steps have valid conditions
   * - At least one entry point
   */
  validateDAG(definition: WorkflowDefinition): DAGValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const stepIds = new Set(definition.steps.map(s => s.id));

    // Check for duplicate step IDs
    if (stepIds.size !== definition.steps.length) {
      errors.push('Duplicate step IDs detected');
    }

    // Check dependency references
    for (const step of definition.steps) {
      for (const dep of step.dependsOn) {
        if (!stepIds.has(dep)) {
          errors.push(`Step "${step.id}" depends on non-existent step "${dep}"`);
        }
        if (dep === step.id) {
          errors.push(`Step "${step.id}" cannot depend on itself`);
        }
      }
      if (step.compensationStepId && !stepIds.has(step.compensationStepId)) {
        errors.push(`Step "${step.id}" references non-existent compensation step "${step.compensationStepId}"`);
      }
      if (step.type === 'decision' && !step.condition) {
        errors.push(`Decision step "${step.id}" is missing a condition`);
      }
      if (step.condition) {
        if (!stepIds.has(step.condition.trueStepId)) {
          errors.push(`Decision step "${step.id}" true branch references non-existent step "${step.condition.trueStepId}"`);
        }
        if (!stepIds.has(step.condition.falseStepId)) {
          errors.push(`Decision step "${step.id}" false branch references non-existent step "${step.condition.falseStepId}"`);
        }
      }
    }

    // Topological sort (Kahn's algorithm) to detect cycles
    const inDegree: Record<string, number> = {};
    const adjacency: Record<string, string[]> = {};
    for (const step of definition.steps) {
      inDegree[step.id] = inDegree[step.id] || 0;
      adjacency[step.id] = adjacency[step.id] || [];
    }
    for (const step of definition.steps) {
      for (const dep of step.dependsOn) {
        if (stepIds.has(dep)) {
          adjacency[dep] = adjacency[dep] || [];
          adjacency[dep].push(step.id);
          inDegree[step.id] = (inDegree[step.id] || 0) + 1;
        }
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of Object.entries(inDegree)) {
      if (deg === 0) queue.push(id);
    }

    const topologicalOrder: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      topologicalOrder.push(current);
      for (const neighbor of (adjacency[current] || [])) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (topologicalOrder.length !== stepIds.size) {
      errors.push('Cycle detected in workflow DAG');
    }

    // Entry points (no dependencies)
    const entryPoints = definition.steps
      .filter(s => s.dependsOn.length === 0)
      .map(s => s.id);

    if (entryPoints.length === 0 && definition.steps.length > 0) {
      errors.push('No entry points found (all steps have dependencies)');
    }

    // Exit points (nothing depends on them)
    const dependedOn = new Set<string>();
    for (const step of definition.steps) {
      for (const dep of step.dependsOn) {
        dependedOn.add(dep);
      }
    }
    const exitPoints = definition.steps
      .filter(s => !dependedOn.has(s.id))
      .map(s => s.id);

    // Parallel groups: steps at the same topological "level"
    const parallelGroups = this.computeParallelGroups(definition.steps, topologicalOrder);

    // Warnings
    for (const step of definition.steps) {
      if (step.type === 'action' && !step.compensationStepId && definition.enableSagaCompensation) {
        warnings.push(`Action step "${step.id}" has no compensation step (saga rollback will skip it)`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      topologicalOrder,
      parallelGroups,
      entryPoints,
      exitPoints,
    };
  }

  /**
   * Group steps into parallel execution tiers based on dependency depth.
   */
  private computeParallelGroups(
    steps: WorkflowStepDefinition[],
    topoOrder: string[],
  ): string[][] {
    const depth: Record<string, number> = {};
    const stepMap = new Map(steps.map(s => [s.id, s]));

    for (const id of topoOrder) {
      const step = stepMap.get(id);
      if (!step || step.dependsOn.length === 0) {
        depth[id] = 0;
      } else {
        depth[id] = Math.max(...step.dependsOn.map(d => (depth[d] ?? 0) + 1));
      }
    }

    const groups: Map<number, string[]> = new Map();
    for (const [id, d] of Object.entries(depth)) {
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(id);
    }

    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, ids]) => ids);
  }

  // ────────────────────────────────────────────
  // Workflow Execution
  // ────────────────────────────────────────────

  /**
   * Start executing a workflow. Creates an execution instance
   * and advances the first eligible steps.
   */
  executeWorkflow(workflowId: string, input: Record<string, unknown> = {}): WorkflowExecution {
    const definition = this.getWorkflow(workflowId);
    const execId = generateId('wfx');
    const timestamp = now();

    // Initialize step execution states
    const steps: Record<string, WorkflowStepExecution> = {};
    for (const step of definition.steps) {
      steps[step.id] = {
        stepId: step.id,
        status: 'pending',
        retriesUsed: 0,
        retryHistory: [],
      };
    }

    const execution: WorkflowExecution = {
      id: execId,
      workflowId,
      status: 'running',
      steps,
      context: { ...input },
      input,
      checkpoints: [],
      deadLetters: [],
      circuitBreakers: {},
      completedSteps: 0,
      totalSteps: definition.steps.length,
      startedAt: timestamp,
    };

    this.executions.set(execId, execution);
    this.emitEvent('workflow_started', execId, workflowId, undefined, undefined, { input });

    // Advance to first executable steps
    this.advanceExecution(execution, definition);

    return execution;
  }

  /**
   * Get an execution by ID.
   */
  getExecution(executionId: string): WorkflowExecution {
    const exec = this.executions.get(executionId);
    if (!exec) throw new Error(`Execution not found: ${executionId}`);
    return exec;
  }

  /**
   * List all executions, optionally filtered by workflow ID.
   */
  listExecutions(workflowId?: string): WorkflowExecution[] {
    const all = Array.from(this.executions.values());
    if (workflowId) return all.filter(e => e.workflowId === workflowId);
    return all;
  }

  /**
   * Pause a running execution. Steps already running will complete,
   * but no new steps will be started.
   */
  pauseExecution(executionId: string): WorkflowExecution {
    const exec = this.getExecution(executionId);
    if (exec.status !== 'running') {
      throw new Error(`Cannot pause execution in status "${exec.status}"`);
    }
    exec.status = 'paused';
    this.emitEvent('workflow_paused', executionId, exec.workflowId);
    return exec;
  }

  /**
   * Resume a paused execution.
   */
  resumeExecution(executionId: string): WorkflowExecution {
    const exec = this.getExecution(executionId);
    if (exec.status !== 'paused') {
      throw new Error(`Cannot resume execution in status "${exec.status}"`);
    }
    exec.status = 'running';
    const definition = this.getWorkflow(exec.workflowId);
    this.emitEvent('workflow_resumed', executionId, exec.workflowId);
    this.advanceExecution(exec, definition);
    return exec;
  }

  /**
   * Cancel a running or paused execution.
   */
  cancelExecution(executionId: string): WorkflowExecution {
    const exec = this.getExecution(executionId);
    if (TERMINAL_WORKFLOW_STATUSES.includes(exec.status)) {
      throw new Error(`Cannot cancel execution in terminal status "${exec.status}"`);
    }
    exec.status = 'cancelled';
    exec.completedAt = now();
    exec.durationMs = new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime();
    this.emitEvent('workflow_cancelled', executionId, exec.workflowId);
    return exec;
  }

  // ────────────────────────────────────────────
  // Step Completion & Failure
  // ────────────────────────────────────────────

  /**
   * Mark a step as completed with output.
   * Advances the workflow to the next eligible steps.
   */
  completeStep(
    executionId: string,
    stepId: string,
    output: Record<string, unknown> = {},
  ): WorkflowExecution {
    const exec = this.getExecution(executionId);
    const definition = this.getWorkflow(exec.workflowId);
    const stepExec = exec.steps[stepId];
    if (!stepExec) throw new Error(`Step not found: ${stepId}`);

    if (stepExec.status !== 'running') {
      throw new Error(`Cannot complete step in status "${stepExec.status}"`);
    }

    stepExec.status = 'completed';
    stepExec.output = output;
    stepExec.completedAt = now();
    stepExec.durationMs = stepExec.startedAt
      ? new Date(stepExec.completedAt).getTime() - new Date(stepExec.startedAt).getTime()
      : 0;

    exec.completedSteps++;

    // Merge step output into workflow context
    exec.context[stepId] = output;

    // Update circuit breaker on success
    const stepDef = definition.steps.find(s => s.id === stepId);
    if (stepDef) {
      this.recordCircuitBreakerSuccess(exec, stepDef.targetAgentId, definition.circuitBreakerConfig);
    }

    this.emitEvent('step_completed', executionId, exec.workflowId, stepId, stepDef?.targetAgentId, { output });

    // Check if workflow is complete
    if (this.isWorkflowComplete(exec, definition)) {
      this.finalizeWorkflow(exec, 'completed');
    } else if (exec.status === 'running') {
      this.advanceExecution(exec, definition);
    }

    return exec;
  }

  /**
   * Mark a step as failed. Triggers retry logic, and if retries
   * are exhausted, triggers saga compensation if enabled.
   */
  failStep(
    executionId: string,
    stepId: string,
    error: string,
  ): WorkflowExecution {
    const exec = this.getExecution(executionId);
    const definition = this.getWorkflow(exec.workflowId);
    const stepExec = exec.steps[stepId];
    if (!stepExec) throw new Error(`Step not found: ${stepId}`);

    if (stepExec.status !== 'running') {
      throw new Error(`Cannot fail step in status "${stepExec.status}"`);
    }

    const stepDef = definition.steps.find(s => s.id === stepId);
    if (!stepDef) throw new Error(`Step definition not found: ${stepId}`);

    // Record retry attempt
    const attempt: RetryAttempt = {
      attempt: stepExec.retriesUsed + 1,
      startedAt: stepExec.startedAt || now(),
      endedAt: now(),
      succeeded: false,
      error,
    };
    stepExec.retryHistory.push(attempt);

    // Update circuit breaker on failure
    this.recordCircuitBreakerFailure(exec, stepDef.targetAgentId, definition.circuitBreakerConfig);

    // Check if we can retry
    if (stepExec.retriesUsed < stepDef.retryPolicy.maxRetries) {
      stepExec.retriesUsed++;
      stepExec.status = 'running';
      stepExec.startedAt = now();
      this.emitEvent('step_retrying', executionId, exec.workflowId, stepId, stepDef.targetAgentId, {
        attempt: stepExec.retriesUsed,
        maxRetries: stepDef.retryPolicy.maxRetries,
        error,
      });
      return exec;
    }

    // Retries exhausted
    stepExec.status = 'failed';
    stepExec.error = error;
    stepExec.completedAt = now();
    stepExec.durationMs = stepExec.startedAt
      ? new Date(stepExec.completedAt).getTime() - new Date(stepExec.startedAt).getTime()
      : 0;

    this.emitEvent('step_failed', executionId, exec.workflowId, stepId, stepDef.targetAgentId, { error });

    // Dead letter the failed step
    this.addDeadLetter(exec, stepId, error, stepDef.inputMapping, stepExec.retryHistory);

    // If optional, skip and continue
    if (stepDef.optional) {
      stepExec.status = 'skipped';
      exec.completedSteps++;
      this.emitEvent('step_skipped', executionId, exec.workflowId, stepId);
      if (this.isWorkflowComplete(exec, definition)) {
        this.finalizeWorkflow(exec, 'completed');
      } else {
        this.advanceExecution(exec, definition);
      }
      return exec;
    }

    // Trigger saga compensation if enabled
    if (definition.enableSagaCompensation) {
      this.triggerCompensation(exec, definition);
    } else {
      this.finalizeWorkflow(exec, 'failed');
    }

    return exec;
  }

  /**
   * Mark a step as timed out.
   */
  timeoutStep(executionId: string, stepId: string): WorkflowExecution {
    const exec = this.getExecution(executionId);
    const definition = this.getWorkflow(exec.workflowId);
    const stepExec = exec.steps[stepId];
    if (!stepExec) throw new Error(`Step not found: ${stepId}`);

    const stepDef = definition.steps.find(s => s.id === stepId);
    if (!stepDef) throw new Error(`Step definition not found: ${stepId}`);

    this.emitEvent('step_timed_out', executionId, exec.workflowId, stepId, stepDef.targetAgentId, {
      timeoutMs: stepDef.timeoutMs,
    });

    // If retry on timeout is enabled, treat as a failure for retry purposes
    if (stepDef.retryPolicy.retryOnTimeout) {
      return this.failStep(executionId, stepId, `Step timed out after ${stepDef.timeoutMs}ms`);
    }

    stepExec.status = 'timed_out';
    stepExec.completedAt = now();
    stepExec.error = `Step timed out after ${stepDef.timeoutMs}ms`;

    if (stepDef.optional) {
      stepExec.status = 'skipped';
      exec.completedSteps++;
      this.advanceExecution(exec, definition);
    } else if (definition.enableSagaCompensation) {
      this.triggerCompensation(exec, definition);
    } else {
      this.finalizeWorkflow(exec, 'failed');
    }

    return exec;
  }

  // ────────────────────────────────────────────
  // Saga Compensation
  // ────────────────────────────────────────────

  /**
   * Trigger saga compensation: run compensation steps in reverse
   * order for all completed steps that have compensation defined.
   */
  private triggerCompensation(
    exec: WorkflowExecution,
    definition: WorkflowDefinition,
  ): void {
    exec.status = 'compensating';
    this.emitEvent('workflow_compensating', exec.id, exec.workflowId);

    // Find all completed steps that need compensation, in reverse order
    const validation = this.validateDAG(definition);
    const completedStepIds = validation.topologicalOrder
      .filter(id => exec.steps[id]?.status === 'completed')
      .reverse();

    let allCompensated = true;

    for (const stepId of completedStepIds) {
      const stepDef = definition.steps.find(s => s.id === stepId);
      if (!stepDef?.compensationStepId) continue;

      const compStep = exec.steps[stepDef.compensationStepId];
      if (compStep) {
        compStep.status = 'compensating';
        compStep.startedAt = now();
        this.emitEvent('step_compensating', exec.id, exec.workflowId, stepDef.compensationStepId);

        // In a real system, this would invoke the compensation action on the agent.
        // For now, we mark it as compensated immediately (the external caller
        // would complete it via completeCompensation).
        compStep.status = 'compensated';
        compStep.completedAt = now();
        this.emitEvent('step_compensated', exec.id, exec.workflowId, stepDef.compensationStepId);
      } else {
        allCompensated = false;
      }
    }

    if (allCompensated) {
      this.finalizeWorkflow(exec, 'compensated');
    } else {
      this.finalizeWorkflow(exec, 'failed');
    }
  }

  /**
   * Manually complete a compensation step (for async compensation).
   */
  completeCompensation(
    executionId: string,
    stepId: string,
  ): WorkflowExecution {
    const exec = this.getExecution(executionId);
    const stepExec = exec.steps[stepId];
    if (!stepExec) throw new Error(`Step not found: ${stepId}`);

    stepExec.status = 'compensated';
    stepExec.completedAt = now();
    this.emitEvent('step_compensated', executionId, exec.workflowId, stepId);
    return exec;
  }

  // ────────────────────────────────────────────
  // Circuit Breaker
  // ────────────────────────────────────────────

  /**
   * Check if a circuit breaker allows a call to the target agent.
   */
  isCircuitOpen(exec: WorkflowExecution, targetAgentId: string, config: CircuitBreakerConfig): boolean {
    const cb = exec.circuitBreakers[targetAgentId];
    if (!cb) return false;

    if (cb.state === 'open') {
      // Check if reset timeout has elapsed
      if (cb.lastOpenedAt) {
        const elapsed = Date.now() - new Date(cb.lastOpenedAt).getTime();
        if (elapsed >= config.resetTimeoutMs) {
          // Transition to half-open
          cb.state = 'half_open';
          cb.halfOpenSuccesses = 0;
          cb.lastStateChange = now();
          this.emitEvent('circuit_breaker_half_opened', exec.id, exec.workflowId, undefined, targetAgentId, {});
          return false;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Record a successful call for circuit breaker tracking.
   */
  private recordCircuitBreakerSuccess(
    exec: WorkflowExecution,
    targetAgentId: string,
    config: CircuitBreakerConfig,
  ): void {
    const cb = this.getOrCreateCircuitBreaker(exec, targetAgentId);

    if (cb.state === 'half_open') {
      cb.halfOpenSuccesses++;
      if (cb.halfOpenSuccesses >= config.halfOpenSuccessThreshold) {
        cb.state = 'closed';
        cb.consecutiveFailures = 0;
        cb.lastStateChange = now();
        this.emitEvent('circuit_breaker_closed', exec.id, exec.workflowId, undefined, targetAgentId, {});
      }
    } else if (cb.state === 'closed') {
      cb.consecutiveFailures = 0;
    }
  }

  /**
   * Record a failed call for circuit breaker tracking.
   */
  private recordCircuitBreakerFailure(
    exec: WorkflowExecution,
    targetAgentId: string,
    config: CircuitBreakerConfig,
  ): void {
    const cb = this.getOrCreateCircuitBreaker(exec, targetAgentId);
    cb.consecutiveFailures++;

    if (cb.consecutiveFailures >= config.failureThreshold && cb.state === 'closed') {
      cb.state = 'open';
      cb.lastOpenedAt = now();
      cb.lastStateChange = now();
      this.emitEvent('circuit_breaker_opened', exec.id, exec.workflowId, undefined, targetAgentId, {
        consecutiveFailures: cb.consecutiveFailures,
      });
    }
  }

  private getOrCreateCircuitBreaker(
    exec: WorkflowExecution,
    targetAgentId: string,
  ): CircuitBreakerStatus {
    if (!exec.circuitBreakers[targetAgentId]) {
      exec.circuitBreakers[targetAgentId] = {
        targetAgentId,
        state: 'closed',
        consecutiveFailures: 0,
        halfOpenSuccesses: 0,
        lastStateChange: now(),
      };
    }
    return exec.circuitBreakers[targetAgentId];
  }

  /**
   * Get the circuit breaker status for a target agent in an execution.
   */
  getCircuitBreakerStatus(executionId: string, targetAgentId: string): CircuitBreakerStatus | null {
    const exec = this.getExecution(executionId);
    return exec.circuitBreakers[targetAgentId] || null;
  }

  // ────────────────────────────────────────────
  // Checkpointing
  // ────────────────────────────────────────────

  /**
   * Create a checkpoint of the current execution state.
   */
  createCheckpoint(executionId: string, atStepId: string): WorkflowCheckpoint {
    const exec = this.getExecution(executionId);
    const checkpoint: WorkflowCheckpoint = {
      id: generateId('ckpt'),
      executionId,
      atStepId,
      context: JSON.parse(JSON.stringify(exec.context)),
      stepStatuses: Object.fromEntries(
        Object.entries(exec.steps).map(([id, s]) => [id, s.status]),
      ),
      createdAt: now(),
    };

    exec.checkpoints.push(checkpoint);
    this.emitEvent('checkpoint_created', executionId, exec.workflowId, atStepId, undefined, {
      checkpointId: checkpoint.id,
    });
    return checkpoint;
  }

  /**
   * Restore execution state from a checkpoint.
   */
  restoreFromCheckpoint(executionId: string, checkpointId: string): WorkflowExecution {
    const exec = this.getExecution(executionId);
    const checkpoint = exec.checkpoints.find(c => c.id === checkpointId);
    if (!checkpoint) throw new Error(`Checkpoint not found: ${checkpointId}`);

    const definition = this.getWorkflow(exec.workflowId);

    // Restore context
    exec.context = JSON.parse(JSON.stringify(checkpoint.context));

    // Restore step statuses
    let completedCount = 0;
    for (const [stepId, status] of Object.entries(checkpoint.stepStatuses)) {
      if (exec.steps[stepId]) {
        exec.steps[stepId].status = status;
        if (status === 'completed' || status === 'skipped') completedCount++;
        // Reset failed/running steps to pending so they can be re-run
        if (status === 'failed' || status === 'running' || status === 'timed_out') {
          exec.steps[stepId].status = 'pending';
          exec.steps[stepId].retriesUsed = 0;
          exec.steps[stepId].retryHistory = [];
          exec.steps[stepId].error = undefined;
          exec.steps[stepId].output = undefined;
          exec.steps[stepId].startedAt = undefined;
          exec.steps[stepId].completedAt = undefined;
        }
      }
    }

    exec.completedSteps = completedCount;
    exec.status = 'running';

    this.emitEvent('checkpoint_restored', executionId, exec.workflowId, checkpoint.atStepId, undefined, {
      checkpointId,
    });

    this.advanceExecution(exec, definition);
    return exec;
  }

  /**
   * List checkpoints for an execution.
   */
  listCheckpoints(executionId: string): WorkflowCheckpoint[] {
    return this.getExecution(executionId).checkpoints;
  }

  // ────────────────────────────────────────────
  // Dead Letter Queue
  // ────────────────────────────────────────────

  /**
   * Add a failed step to the dead letter queue.
   */
  private addDeadLetter(
    exec: WorkflowExecution,
    stepId: string,
    error: string,
    input: Record<string, unknown>,
    retryHistory: RetryAttempt[],
  ): void {
    const entry: DeadLetterEntry = {
      id: generateId('dl'),
      executionId: exec.id,
      stepId,
      error,
      input,
      retryHistory: [...retryHistory],
      createdAt: now(),
      acknowledged: false,
    };
    exec.deadLetters.push(entry);
    this.emitEvent('dead_letter_created', exec.id, exec.workflowId, stepId, undefined, { error });
  }

  /**
   * Get all dead letter entries for an execution.
   */
  getDeadLetters(executionId: string): DeadLetterEntry[] {
    return this.getExecution(executionId).deadLetters;
  }

  /**
   * Acknowledge a dead letter entry (operator has reviewed it).
   */
  acknowledgeDeadLetter(executionId: string, deadLetterId: string): DeadLetterEntry {
    const exec = this.getExecution(executionId);
    const entry = exec.deadLetters.find(d => d.id === deadLetterId);
    if (!entry) throw new Error(`Dead letter not found: ${deadLetterId}`);
    entry.acknowledged = true;
    return entry;
  }

  // ────────────────────────────────────────────
  // Execution Advancement (DAG Traversal)
  // ────────────────────────────────────────────

  /**
   * Advance the execution: find all steps whose dependencies are satisfied
   * and start them. This is the core scheduling loop.
   */
  private advanceExecution(
    exec: WorkflowExecution,
    definition: WorkflowDefinition,
  ): void {
    if (exec.status !== 'running') return;

    for (const stepDef of definition.steps) {
      const stepExec = exec.steps[stepDef.id];
      if (!stepExec || stepExec.status !== 'pending') continue;

      // Check if all dependencies are satisfied
      const depsCompleted = stepDef.dependsOn.every(depId => {
        const depStatus = exec.steps[depId]?.status;
        return depStatus === 'completed' || depStatus === 'skipped' || depStatus === 'compensated';
      });

      if (!depsCompleted) continue;

      // Handle decision steps
      if (stepDef.type === 'decision' && stepDef.condition) {
        this.evaluateDecision(exec, definition, stepDef);
        continue;
      }

      // Check circuit breaker
      if (this.isCircuitOpen(exec, stepDef.targetAgentId, definition.circuitBreakerConfig)) {
        // Skip this step for now, circuit is open
        continue;
      }

      // Handle checkpoint steps
      if (stepDef.type === 'checkpoint') {
        this.createCheckpoint(exec.id, stepDef.id);
        stepExec.status = 'completed';
        stepExec.startedAt = now();
        stepExec.completedAt = now();
        exec.completedSteps++;
        this.emitEvent('step_completed', exec.id, exec.workflowId, stepDef.id);
        continue;
      }

      // Start the step
      stepExec.status = 'running';
      stepExec.startedAt = now();
      this.emitEvent('step_started', exec.id, exec.workflowId, stepDef.id, stepDef.targetAgentId, {
        action: stepDef.action,
        inputMapping: stepDef.inputMapping,
      });
    }
  }

  /**
   * Evaluate a decision step's condition against the workflow context.
   */
  private evaluateDecision(
    exec: WorkflowExecution,
    definition: WorkflowDefinition,
    stepDef: WorkflowStepDefinition,
  ): void {
    const stepExec = exec.steps[stepDef.id];
    if (!stepDef.condition) return;

    const { expression, operator, value, trueStepId, falseStepId } = stepDef.condition;

    // Resolve expression from context (simple dot-notation)
    const contextValue = this.resolveExpression(exec.context, expression);
    const conditionMet = this.evaluateCondition(contextValue, operator, value);

    stepExec.status = 'completed';
    stepExec.startedAt = now();
    stepExec.completedAt = now();
    stepExec.output = { conditionMet, evaluatedValue: contextValue, operator, expectedValue: value };
    exec.completedSteps++;

    this.emitEvent('step_completed', exec.id, exec.workflowId, stepDef.id, undefined, {
      conditionMet,
      branch: conditionMet ? trueStepId : falseStepId,
    });

    // Skip the branch not taken
    const skippedBranch = conditionMet ? falseStepId : trueStepId;
    this.skipBranch(exec, definition, skippedBranch);

    // Continue advancing
    this.advanceExecution(exec, definition);
  }

  /**
   * Skip a step and all steps that depend exclusively on it.
   */
  private skipBranch(
    exec: WorkflowExecution,
    definition: WorkflowDefinition,
    stepId: string,
  ): void {
    const stepExec = exec.steps[stepId];
    if (!stepExec || stepExec.status !== 'pending') return;

    stepExec.status = 'skipped';
    stepExec.startedAt = now();
    stepExec.completedAt = now();
    exec.completedSteps++;
    this.emitEvent('step_skipped', exec.id, exec.workflowId, stepId);

    // Recursively skip steps that only depend on this step
    for (const step of definition.steps) {
      if (step.dependsOn.length === 1 && step.dependsOn[0] === stepId) {
        this.skipBranch(exec, definition, step.id);
      }
    }
  }

  /**
   * Resolve a dot-notation expression from context.
   * e.g., "step1.price" resolves context.step1.price
   */
  private resolveExpression(context: Record<string, unknown>, expression: string): unknown {
    const parts = expression.split('.');
    let current: unknown = context;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  /**
   * Evaluate a condition operator.
   */
  private evaluateCondition(
    actual: unknown,
    operator: string,
    expected: unknown,
  ): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'greater_than':
        return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
      case 'less_than':
        return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
      case 'contains':
        if (typeof actual === 'string' && typeof expected === 'string') return actual.includes(expected);
        if (Array.isArray(actual)) return actual.includes(expected);
        return false;
      case 'exists':
        return actual !== undefined && actual !== null;
      default:
        return false;
    }
  }

  // ────────────────────────────────────────────
  // Workflow Finalization
  // ────────────────────────────────────────────

  /**
   * Check if all steps have reached a terminal state.
   */
  private isWorkflowComplete(exec: WorkflowExecution, definition: WorkflowDefinition): boolean {
    return definition.steps.every(step => {
      const status = exec.steps[step.id]?.status;
      return TERMINAL_STEP_STATUSES.includes(status as StepStatus);
    });
  }

  /**
   * Finalize a workflow execution.
   */
  private finalizeWorkflow(exec: WorkflowExecution, status: WorkflowStatus): void {
    exec.status = status;
    exec.completedAt = now();
    exec.durationMs = new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime();

    // Aggregate outputs from completed steps
    const output: Record<string, unknown> = {};
    for (const [stepId, stepExec] of Object.entries(exec.steps)) {
      if (stepExec.status === 'completed' && stepExec.output) {
        output[stepId] = stepExec.output;
      }
    }
    exec.output = output;

    const eventType: WorkflowEventType =
      status === 'completed' ? 'workflow_completed' :
      status === 'compensated' ? 'workflow_compensated' :
      'workflow_failed';

    this.emitEvent(eventType, exec.id, exec.workflowId, undefined, undefined, {
      completedSteps: exec.completedSteps,
      totalSteps: exec.totalSteps,
      durationMs: exec.durationMs,
    });
  }

  // ────────────────────────────────────────────
  // Retry Delay Calculation
  // ────────────────────────────────────────────

  /**
   * Calculate the delay before the next retry attempt.
   */
  calculateRetryDelay(policy: RetryPolicy, attempt: number): number {
    let delay: number;
    switch (policy.strategy) {
      case 'fixed':
        delay = policy.baseDelayMs;
        break;
      case 'exponential':
        delay = policy.baseDelayMs * Math.pow(2, attempt - 1);
        break;
      case 'linear':
        delay = policy.baseDelayMs * attempt;
        break;
      default:
        delay = policy.baseDelayMs;
    }
    return Math.min(delay, policy.maxDelayMs);
  }

  // ────────────────────────────────────────────
  // Execution Progress
  // ────────────────────────────────────────────

  /**
   * Get a summary of execution progress.
   */
  getProgress(executionId: string): {
    status: WorkflowStatus;
    completedSteps: number;
    totalSteps: number;
    percentComplete: number;
    runningSteps: string[];
    failedSteps: string[];
    pendingSteps: string[];
  } {
    const exec = this.getExecution(executionId);
    const running: string[] = [];
    const failed: string[] = [];
    const pending: string[] = [];

    for (const [stepId, stepExec] of Object.entries(exec.steps)) {
      if (stepExec.status === 'running') running.push(stepId);
      else if (stepExec.status === 'failed') failed.push(stepId);
      else if (stepExec.status === 'pending') pending.push(stepId);
    }

    return {
      status: exec.status,
      completedSteps: exec.completedSteps,
      totalSteps: exec.totalSteps,
      percentComplete: exec.totalSteps > 0 ? Math.round((exec.completedSteps / exec.totalSteps) * 100) : 0,
      runningSteps: running,
      failedSteps: failed,
      pendingSteps: pending,
    };
  }

  // ────────────────────────────────────────────
  // Audit
  // ────────────────────────────────────────────

  private emitEvent(
    eventType: WorkflowEventType,
    executionId: string,
    workflowId: string,
    stepId?: string,
    agentId?: string,
    details: Record<string, unknown> = {},
  ): void {
    this.auditLog.push({
      id: generateId('wfa'),
      eventType,
      executionId,
      workflowId,
      stepId,
      agentId,
      details,
      timestamp: now(),
    });
  }

  /**
   * Get audit log entries for an execution.
   */
  getAuditLog(executionId?: string): WorkflowAuditEntry[] {
    if (executionId) return this.auditLog.filter(e => e.executionId === executionId);
    return [...this.auditLog];
  }

  /**
   * Reset engine state (for testing).
   */
  reset(): void {
    this.definitions.clear();
    this.executions.clear();
    this.auditLog = [];
  }
}

// ──────────────────────────────────────────────
// Singleton
// ──────────────────────────────────────────────

export const workflowOrchestrationEngine = new WorkflowOrchestrationEngine();
