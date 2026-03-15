/**
 * Distributed Agent Workflow Orchestration Protocol -- Tests
 *
 * Comprehensive tests covering:
 *   1. Workflow creation and DAG validation
 *   2. Cycle detection in DAG
 *   3. Topological ordering and parallel group computation
 *   4. Basic linear workflow execution
 *   5. Parallel workflow execution (DAG with parallel branches)
 *   6. Step completion advancing workflow
 *   7. Step failure with retry logic
 *   8. Retry exhaustion triggers saga compensation
 *   9. Optional step failure skips and continues
 *   10. Circuit breaker opens after threshold failures
 *   11. Circuit breaker transitions to half-open and closed
 *   12. Checkpoint creation and restoration
 *   13. Dead letter queue for unrecoverable failures
 *   14. Pause and resume execution
 *   15. Cancel execution
 *   16. Decision step with conditional branching
 *   17. Step timeout handling
 *   18. Retry delay calculation (fixed, exponential, linear)
 *   19. Progress tracking
 *   20. Full audit trail
 *   21. Workflow with compensation steps (saga pattern end-to-end)
 *   22. Edge cases (empty workflow, missing refs, self-dependency)
 */

import { WorkflowOrchestrationEngine } from '@/lib/a2a/workflow-orchestration/engine';
import { CreateWorkflowRequest } from '@/lib/a2a/workflow-orchestration/types';

// ──────────────────────────────────────────────
// Test Fixtures
// ──────────────────────────────────────────────

function createLinearWorkflow(engine: WorkflowOrchestrationEngine): string {
  const wf = engine.createWorkflow({
    name: 'Linear Pipeline',
    description: 'A simple A -> B -> C pipeline',
    creatorAgentId: 'agent-orchestrator',
    steps: [
      {
        id: 'step-a',
        name: 'Fetch Data',
        type: 'action',
        targetAgentId: 'agent-fetcher',
        action: 'fetch_data',
        inputMapping: { source: 'api' },
        dependsOn: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 2, baseDelayMs: 1000, maxDelayMs: 5000, strategy: 'exponential', retryOnTimeout: true },
        optional: false,
      },
      {
        id: 'step-b',
        name: 'Transform Data',
        type: 'action',
        targetAgentId: 'agent-transformer',
        action: 'transform',
        inputMapping: { format: 'json' },
        dependsOn: ['step-a'],
        timeoutMs: 60_000,
        retryPolicy: { maxRetries: 1, baseDelayMs: 2000, maxDelayMs: 10000, strategy: 'fixed', retryOnTimeout: false },
        optional: false,
      },
      {
        id: 'step-c',
        name: 'Store Results',
        type: 'action',
        targetAgentId: 'agent-storage',
        action: 'store',
        inputMapping: { destination: 'db' },
        dependsOn: ['step-b'],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0, baseDelayMs: 1000, maxDelayMs: 1000, strategy: 'fixed', retryOnTimeout: false },
        optional: false,
      },
    ],
  });
  return wf.id;
}

function createParallelWorkflow(engine: WorkflowOrchestrationEngine): string {
  const wf = engine.createWorkflow({
    name: 'Parallel Fan-Out',
    description: 'A -> (B, C) -> D fan-out/fan-in',
    creatorAgentId: 'agent-orchestrator',
    steps: [
      {
        id: 'init',
        name: 'Initialize',
        type: 'action',
        targetAgentId: 'agent-init',
        action: 'init',
        inputMapping: {},
        dependsOn: [],
        timeoutMs: 10_000,
        retryPolicy: { maxRetries: 0, baseDelayMs: 1000, maxDelayMs: 1000, strategy: 'fixed', retryOnTimeout: false },
        optional: false,
      },
      {
        id: 'branch-1',
        name: 'Branch 1',
        type: 'action',
        targetAgentId: 'agent-worker-1',
        action: 'process_a',
        inputMapping: {},
        dependsOn: ['init'],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 1, baseDelayMs: 1000, maxDelayMs: 5000, strategy: 'exponential', retryOnTimeout: true },
        optional: false,
      },
      {
        id: 'branch-2',
        name: 'Branch 2',
        type: 'action',
        targetAgentId: 'agent-worker-2',
        action: 'process_b',
        inputMapping: {},
        dependsOn: ['init'],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 1, baseDelayMs: 1000, maxDelayMs: 5000, strategy: 'exponential', retryOnTimeout: true },
        optional: false,
      },
      {
        id: 'aggregate',
        name: 'Aggregate Results',
        type: 'action',
        targetAgentId: 'agent-aggregator',
        action: 'aggregate',
        inputMapping: {},
        dependsOn: ['branch-1', 'branch-2'],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0, baseDelayMs: 1000, maxDelayMs: 1000, strategy: 'fixed', retryOnTimeout: false },
        optional: false,
      },
    ],
  });
  return wf.id;
}

function createSagaWorkflow(engine: WorkflowOrchestrationEngine): string {
  const wf = engine.createWorkflow({
    name: 'Saga Transaction',
    description: 'Multi-step with compensation actions',
    creatorAgentId: 'agent-orchestrator',
    enableSagaCompensation: true,
    steps: [
      {
        id: 'reserve',
        name: 'Reserve Resources',
        type: 'action',
        targetAgentId: 'agent-resource',
        action: 'reserve',
        inputMapping: {},
        dependsOn: [],
        compensationStepId: 'undo-reserve',
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 1, baseDelayMs: 1000, maxDelayMs: 5000, strategy: 'fixed', retryOnTimeout: true },
        optional: false,
      },
      {
        id: 'undo-reserve',
        name: 'Undo Reservation',
        type: 'compensation',
        targetAgentId: 'agent-resource',
        action: 'release',
        inputMapping: {},
        dependsOn: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0, baseDelayMs: 1000, maxDelayMs: 1000, strategy: 'fixed', retryOnTimeout: false },
        optional: false,
      },
      {
        id: 'charge',
        name: 'Charge Payment',
        type: 'action',
        targetAgentId: 'agent-billing',
        action: 'charge',
        inputMapping: { amount: 100 },
        dependsOn: ['reserve'],
        compensationStepId: 'refund',
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0, baseDelayMs: 1000, maxDelayMs: 1000, strategy: 'fixed', retryOnTimeout: false },
        optional: false,
      },
      {
        id: 'refund',
        name: 'Refund Payment',
        type: 'compensation',
        targetAgentId: 'agent-billing',
        action: 'refund',
        inputMapping: {},
        dependsOn: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0, baseDelayMs: 1000, maxDelayMs: 1000, strategy: 'fixed', retryOnTimeout: false },
        optional: false,
      },
      {
        id: 'fulfill',
        name: 'Fulfill Order',
        type: 'action',
        targetAgentId: 'agent-fulfillment',
        action: 'fulfill',
        inputMapping: {},
        dependsOn: ['charge'],
        timeoutMs: 60_000,
        retryPolicy: { maxRetries: 0, baseDelayMs: 1000, maxDelayMs: 1000, strategy: 'fixed', retryOnTimeout: false },
        optional: false,
      },
    ],
  });
  return wf.id;
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Distributed Agent Workflow Orchestration Protocol', () => {
  let engine: WorkflowOrchestrationEngine;

  beforeEach(() => {
    engine = new WorkflowOrchestrationEngine();
  });

  // ── 1. Workflow Creation ──

  describe('Workflow Creation & DAG Validation', () => {
    test('creates a valid linear workflow', () => {
      const wfId = createLinearWorkflow(engine);
      const wf = engine.getWorkflow(wfId);
      expect(wf.name).toBe('Linear Pipeline');
      expect(wf.steps).toHaveLength(3);
      expect(wf.enableSagaCompensation).toBe(true);
    });

    test('creates a valid parallel workflow', () => {
      const wfId = createParallelWorkflow(engine);
      const wf = engine.getWorkflow(wfId);
      expect(wf.steps).toHaveLength(4);
    });

    test('validates DAG and returns topological order', () => {
      const wfId = createLinearWorkflow(engine);
      const wf = engine.getWorkflow(wfId);
      const validation = engine.validateDAG(wf);
      expect(validation.valid).toBe(true);
      expect(validation.topologicalOrder).toEqual(['step-a', 'step-b', 'step-c']);
      expect(validation.entryPoints).toEqual(['step-a']);
      expect(validation.exitPoints).toEqual(['step-c']);
    });

    test('detects parallel groups in DAG', () => {
      const wfId = createParallelWorkflow(engine);
      const wf = engine.getWorkflow(wfId);
      const validation = engine.validateDAG(wf);
      expect(validation.valid).toBe(true);
      // init at depth 0, branch-1 and branch-2 at depth 1, aggregate at depth 2
      expect(validation.parallelGroups).toHaveLength(3);
      expect(validation.parallelGroups[0]).toEqual(['init']);
      expect(validation.parallelGroups[1].sort()).toEqual(['branch-1', 'branch-2']);
      expect(validation.parallelGroups[2]).toEqual(['aggregate']);
    });

    test('rejects workflow with cycle', () => {
      expect(() => {
        engine.createWorkflow({
          name: 'Cyclic',
          description: 'Has a cycle',
          creatorAgentId: 'agent-x',
          steps: [
            { id: 'a', name: 'A', type: 'action', targetAgentId: 'x', action: 'a', inputMapping: {}, dependsOn: ['b'], timeoutMs: 1000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
            { id: 'b', name: 'B', type: 'action', targetAgentId: 'x', action: 'b', inputMapping: {}, dependsOn: ['a'], timeoutMs: 1000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
          ],
        });
      }).toThrow(/Cycle detected/);
    });

    test('rejects workflow with missing dependency reference', () => {
      expect(() => {
        engine.createWorkflow({
          name: 'Bad Ref',
          description: 'References missing step',
          creatorAgentId: 'agent-x',
          steps: [
            { id: 'a', name: 'A', type: 'action', targetAgentId: 'x', action: 'a', inputMapping: {}, dependsOn: ['nonexistent'], timeoutMs: 1000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
          ],
        });
      }).toThrow(/non-existent step/);
    });

    test('rejects workflow with self-dependency', () => {
      expect(() => {
        engine.createWorkflow({
          name: 'Self Dep',
          description: 'Depends on itself',
          creatorAgentId: 'agent-x',
          steps: [
            { id: 'a', name: 'A', type: 'action', targetAgentId: 'x', action: 'a', inputMapping: {}, dependsOn: ['a'], timeoutMs: 1000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
          ],
        });
      }).toThrow(/cannot depend on itself/);
    });

    test('lists all workflows', () => {
      createLinearWorkflow(engine);
      createParallelWorkflow(engine);
      expect(engine.listWorkflows()).toHaveLength(2);
    });
  });

  // ── 2. Linear Execution ──

  describe('Linear Workflow Execution', () => {
    test('starts execution and first step is running', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId, { userId: 'u1' });
      expect(exec.status).toBe('running');
      expect(exec.steps['step-a'].status).toBe('running');
      expect(exec.steps['step-b'].status).toBe('pending');
      expect(exec.steps['step-c'].status).toBe('pending');
      expect(exec.input).toEqual({ userId: 'u1' });
    });

    test('completing steps advances the workflow sequentially', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);

      engine.completeStep(exec.id, 'step-a', { data: [1, 2, 3] });
      const afterA = engine.getExecution(exec.id);
      expect(afterA.steps['step-a'].status).toBe('completed');
      expect(afterA.steps['step-b'].status).toBe('running');
      expect(afterA.context['step-a']).toEqual({ data: [1, 2, 3] });

      engine.completeStep(exec.id, 'step-b', { transformed: true });
      const afterB = engine.getExecution(exec.id);
      expect(afterB.steps['step-b'].status).toBe('completed');
      expect(afterB.steps['step-c'].status).toBe('running');

      engine.completeStep(exec.id, 'step-c', { stored: true });
      const afterC = engine.getExecution(exec.id);
      expect(afterC.status).toBe('completed');
      expect(afterC.completedSteps).toBe(3);
      expect(afterC.output).toBeDefined();
      expect(afterC.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 3. Parallel Execution ──

  describe('Parallel Workflow Execution', () => {
    test('parallel branches start after init completes', () => {
      const wfId = createParallelWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);

      expect(exec.steps['init'].status).toBe('running');
      engine.completeStep(exec.id, 'init', {});
      const after = engine.getExecution(exec.id);
      expect(after.steps['branch-1'].status).toBe('running');
      expect(after.steps['branch-2'].status).toBe('running');
      expect(after.steps['aggregate'].status).toBe('pending');
    });

    test('aggregate waits for both branches', () => {
      const wfId = createParallelWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);
      engine.completeStep(exec.id, 'init', {});

      engine.completeStep(exec.id, 'branch-1', { r1: 'done' });
      let current = engine.getExecution(exec.id);
      expect(current.steps['aggregate'].status).toBe('pending');

      engine.completeStep(exec.id, 'branch-2', { r2: 'done' });
      current = engine.getExecution(exec.id);
      expect(current.steps['aggregate'].status).toBe('running');

      engine.completeStep(exec.id, 'aggregate', { merged: true });
      current = engine.getExecution(exec.id);
      expect(current.status).toBe('completed');
    });
  });

  // ── 4. Retry Logic ──

  describe('Step Failure & Retry', () => {
    test('retries a step on failure', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);

      // step-a has maxRetries=2
      engine.failStep(exec.id, 'step-a', 'Connection refused');
      let current = engine.getExecution(exec.id);
      expect(current.steps['step-a'].status).toBe('running'); // retrying
      expect(current.steps['step-a'].retriesUsed).toBe(1);

      engine.failStep(exec.id, 'step-a', 'Connection refused again');
      current = engine.getExecution(exec.id);
      expect(current.steps['step-a'].status).toBe('running'); // still retrying
      expect(current.steps['step-a'].retriesUsed).toBe(2);

      // Third failure exhausts retries
      engine.failStep(exec.id, 'step-a', 'Giving up');
      current = engine.getExecution(exec.id);
      expect(current.steps['step-a'].status).toBe('failed');
      expect(current.steps['step-a'].retryHistory).toHaveLength(3);
    });

    test('retry after failure then success completes normally', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);

      engine.failStep(exec.id, 'step-a', 'Transient error');
      expect(engine.getExecution(exec.id).steps['step-a'].retriesUsed).toBe(1);

      engine.completeStep(exec.id, 'step-a', { data: 'ok' });
      const current = engine.getExecution(exec.id);
      expect(current.steps['step-a'].status).toBe('completed');
      expect(current.steps['step-b'].status).toBe('running');
    });
  });

  // ── 5. Saga Compensation ──

  describe('Saga Compensation', () => {
    test('triggers compensation on failure in saga workflow', () => {
      const wfId = createSagaWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);

      // Complete reserve
      engine.completeStep(exec.id, 'reserve', { reservationId: 'r1' });
      // Complete charge
      engine.completeStep(exec.id, 'charge', { chargeId: 'c1' });
      // Fulfill fails (0 retries)
      engine.failStep(exec.id, 'fulfill', 'Out of stock');

      const current = engine.getExecution(exec.id);
      expect(current.status).toBe('compensated');
      // Compensation steps should have been triggered for completed steps
      expect(current.steps['refund'].status).toBe('compensated');
      expect(current.steps['undo-reserve'].status).toBe('compensated');
    });

    test('workflow without saga compensation just fails', () => {
      const wf = engine.createWorkflow({
        name: 'No Saga',
        description: 'No compensation',
        creatorAgentId: 'agent-x',
        enableSagaCompensation: false,
        steps: [
          { id: 's1', name: 'S1', type: 'action', targetAgentId: 'a1', action: 'do', inputMapping: {}, dependsOn: [], timeoutMs: 10_000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
        ],
      });
      const exec = engine.executeWorkflow(wf.id);
      engine.failStep(exec.id, 's1', 'boom');
      expect(engine.getExecution(exec.id).status).toBe('failed');
    });
  });

  // ── 6. Optional Steps ──

  describe('Optional Steps', () => {
    test('optional step failure skips and continues', () => {
      const wf = engine.createWorkflow({
        name: 'With Optional',
        description: 'Optional step in middle',
        creatorAgentId: 'agent-x',
        steps: [
          { id: 's1', name: 'S1', type: 'action', targetAgentId: 'a1', action: 'do', inputMapping: {}, dependsOn: [], timeoutMs: 10_000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
          { id: 's2', name: 'S2 (optional)', type: 'action', targetAgentId: 'a2', action: 'maybe', inputMapping: {}, dependsOn: ['s1'], timeoutMs: 10_000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: true },
          { id: 's3', name: 'S3', type: 'action', targetAgentId: 'a3', action: 'final', inputMapping: {}, dependsOn: ['s2'], timeoutMs: 10_000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
        ],
      });

      const exec = engine.executeWorkflow(wf.id);
      engine.completeStep(exec.id, 's1', {});
      engine.failStep(exec.id, 's2', 'Optional failure');

      const current = engine.getExecution(exec.id);
      expect(current.steps['s2'].status).toBe('skipped');
      expect(current.steps['s3'].status).toBe('running');
    });
  });

  // ── 7. Circuit Breaker ──

  describe('Circuit Breaker', () => {
    test('opens circuit after threshold failures', () => {
      const wf = engine.createWorkflow({
        name: 'CB Test',
        description: 'Circuit breaker testing',
        creatorAgentId: 'agent-x',
        circuitBreakerConfig: { failureThreshold: 2, resetTimeoutMs: 5000, halfOpenSuccessThreshold: 1 },
        steps: [
          { id: 's1', name: 'S1', type: 'action', targetAgentId: 'fragile-agent', action: 'call', inputMapping: {}, dependsOn: [], timeoutMs: 10_000, retryPolicy: { maxRetries: 5, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
        ],
      });

      const exec = engine.executeWorkflow(wf.id);

      // Fail twice to open circuit (threshold=2)
      engine.failStep(exec.id, 's1', 'fail 1');
      engine.failStep(exec.id, 's1', 'fail 2');

      const cb = engine.getCircuitBreakerStatus(exec.id, 'fragile-agent');
      expect(cb).not.toBeNull();
      expect(cb!.state).toBe('open');
      expect(cb!.consecutiveFailures).toBe(2);
    });

    test('circuit breaker resets on success', () => {
      const wf = engine.createWorkflow({
        name: 'CB Reset',
        description: 'Circuit breaker reset test',
        creatorAgentId: 'agent-x',
        circuitBreakerConfig: { failureThreshold: 3, resetTimeoutMs: 1, halfOpenSuccessThreshold: 1 },
        steps: [
          { id: 's1', name: 'S1', type: 'action', targetAgentId: 'agent-a', action: 'call', inputMapping: {}, dependsOn: [], timeoutMs: 10_000, retryPolicy: { maxRetries: 5, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
        ],
      });

      const exec = engine.executeWorkflow(wf.id);
      // Fail to open, then succeed
      engine.failStep(exec.id, 's1', 'f1');
      engine.failStep(exec.id, 's1', 'f2');

      // Complete successfully
      engine.completeStep(exec.id, 's1', { ok: true });
      const cb = engine.getCircuitBreakerStatus(exec.id, 'agent-a');
      expect(cb!.consecutiveFailures).toBe(0);
    });
  });

  // ── 8. Checkpointing ──

  describe('Checkpointing', () => {
    test('creates and restores checkpoint', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);
      engine.completeStep(exec.id, 'step-a', { data: 'original' });

      // Checkpoint after step-a
      const ckpt = engine.createCheckpoint(exec.id, 'step-a');
      expect(ckpt.executionId).toBe(exec.id);
      expect(ckpt.atStepId).toBe('step-a');
      expect(ckpt.context['step-a']).toEqual({ data: 'original' });

      // Fail step-b
      engine.failStep(exec.id, 'step-b', 'bad transform');

      // Restore from checkpoint
      const restored = engine.restoreFromCheckpoint(exec.id, ckpt.id);
      expect(restored.status).toBe('running');
      expect(restored.steps['step-a'].status).toBe('completed');
      expect(restored.steps['step-b'].status).toBe('running'); // re-started
      expect(restored.context['step-a']).toEqual({ data: 'original' });
    });

    test('lists checkpoints', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);
      engine.createCheckpoint(exec.id, 'step-a');
      engine.createCheckpoint(exec.id, 'step-a');
      expect(engine.listCheckpoints(exec.id)).toHaveLength(2);
    });
  });

  // ── 9. Dead Letter Queue ──

  describe('Dead Letter Queue', () => {
    test('dead letters failed steps after retry exhaustion', () => {
      const wf = engine.createWorkflow({
        name: 'DLQ Test',
        description: 'Dead letter testing',
        creatorAgentId: 'agent-x',
        enableSagaCompensation: false,
        steps: [
          { id: 's1', name: 'S1', type: 'action', targetAgentId: 'a1', action: 'do', inputMapping: { key: 'val' }, dependsOn: [], timeoutMs: 10_000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
        ],
      });

      const exec = engine.executeWorkflow(wf.id);
      engine.failStep(exec.id, 's1', 'Permanent failure');

      const dls = engine.getDeadLetters(exec.id);
      expect(dls).toHaveLength(1);
      expect(dls[0].stepId).toBe('s1');
      expect(dls[0].error).toBe('Permanent failure');
      expect(dls[0].acknowledged).toBe(false);
    });

    test('acknowledges dead letter', () => {
      const wf = engine.createWorkflow({
        name: 'DLQ Ack',
        description: 'DLQ ack test',
        creatorAgentId: 'agent-x',
        enableSagaCompensation: false,
        steps: [
          { id: 's1', name: 'S1', type: 'action', targetAgentId: 'a1', action: 'do', inputMapping: {}, dependsOn: [], timeoutMs: 10_000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
        ],
      });

      const exec = engine.executeWorkflow(wf.id);
      engine.failStep(exec.id, 's1', 'err');
      const dls = engine.getDeadLetters(exec.id);
      const acked = engine.acknowledgeDeadLetter(exec.id, dls[0].id);
      expect(acked.acknowledged).toBe(true);
    });
  });

  // ── 10. Pause & Resume ──

  describe('Pause & Resume', () => {
    test('pauses a running execution', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);
      const paused = engine.pauseExecution(exec.id);
      expect(paused.status).toBe('paused');
    });

    test('resumes a paused execution', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);
      engine.pauseExecution(exec.id);
      const resumed = engine.resumeExecution(exec.id);
      expect(resumed.status).toBe('running');
    });

    test('cannot pause non-running execution', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);
      engine.pauseExecution(exec.id);
      expect(() => engine.pauseExecution(exec.id)).toThrow(/Cannot pause/);
    });

    test('cannot resume non-paused execution', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);
      expect(() => engine.resumeExecution(exec.id)).toThrow(/Cannot resume/);
    });
  });

  // ── 11. Cancel ──

  describe('Cancel Execution', () => {
    test('cancels a running execution', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);
      const cancelled = engine.cancelExecution(exec.id);
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.completedAt).toBeDefined();
    });

    test('cannot cancel already completed execution', () => {
      const wf = engine.createWorkflow({
        name: 'Quick',
        description: 'One step',
        creatorAgentId: 'x',
        steps: [
          { id: 's1', name: 'S1', type: 'action', targetAgentId: 'a', action: 'do', inputMapping: {}, dependsOn: [], timeoutMs: 10_000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
        ],
      });
      const exec = engine.executeWorkflow(wf.id);
      engine.completeStep(exec.id, 's1', {});
      expect(() => engine.cancelExecution(exec.id)).toThrow(/terminal status/);
    });
  });

  // ── 12. Decision Steps ──

  describe('Decision Steps (Conditional Branching)', () => {
    test('branches based on condition evaluation', () => {
      const wf = engine.createWorkflow({
        name: 'Decision',
        description: 'Conditional branching',
        creatorAgentId: 'x',
        steps: [
          { id: 'fetch', name: 'Fetch', type: 'action', targetAgentId: 'a1', action: 'fetch', inputMapping: {}, dependsOn: [], timeoutMs: 10_000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
          {
            id: 'decide', name: 'Decide', type: 'decision', targetAgentId: 'system', action: 'evaluate',
            inputMapping: {}, dependsOn: ['fetch'], timeoutMs: 5_000,
            retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false },
            condition: { expression: 'fetch.price', operator: 'greater_than', value: 50, trueStepId: 'premium', falseStepId: 'standard' },
            optional: false,
          },
          { id: 'premium', name: 'Premium Path', type: 'action', targetAgentId: 'a2', action: 'premium', inputMapping: {}, dependsOn: ['decide'], timeoutMs: 10_000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
          { id: 'standard', name: 'Standard Path', type: 'action', targetAgentId: 'a3', action: 'standard', inputMapping: {}, dependsOn: ['decide'], timeoutMs: 10_000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
        ],
      });

      const exec = engine.executeWorkflow(wf.id);
      engine.completeStep(exec.id, 'fetch', { price: 75 });

      const after = engine.getExecution(exec.id);
      // Decision should have been evaluated automatically
      expect(after.steps['decide'].status).toBe('completed');
      expect(after.steps['premium'].status).toBe('running');
      expect(after.steps['standard'].status).toBe('skipped');
    });

    test('branches to false path when condition not met', () => {
      const wf = engine.createWorkflow({
        name: 'Decision False',
        description: 'False branch',
        creatorAgentId: 'x',
        steps: [
          { id: 'fetch', name: 'Fetch', type: 'action', targetAgentId: 'a1', action: 'fetch', inputMapping: {}, dependsOn: [], timeoutMs: 10_000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
          {
            id: 'decide', name: 'Decide', type: 'decision', targetAgentId: 'system', action: 'evaluate',
            inputMapping: {}, dependsOn: ['fetch'], timeoutMs: 5_000,
            retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false },
            condition: { expression: 'fetch.price', operator: 'greater_than', value: 50, trueStepId: 'premium', falseStepId: 'standard' },
            optional: false,
          },
          { id: 'premium', name: 'Premium', type: 'action', targetAgentId: 'a2', action: 'premium', inputMapping: {}, dependsOn: ['decide'], timeoutMs: 10_000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
          { id: 'standard', name: 'Standard', type: 'action', targetAgentId: 'a3', action: 'standard', inputMapping: {}, dependsOn: ['decide'], timeoutMs: 10_000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
        ],
      });

      const exec = engine.executeWorkflow(wf.id);
      engine.completeStep(exec.id, 'fetch', { price: 25 });

      const after = engine.getExecution(exec.id);
      expect(after.steps['premium'].status).toBe('skipped');
      expect(after.steps['standard'].status).toBe('running');
    });
  });

  // ── 13. Step Timeout ──

  describe('Step Timeout', () => {
    test('times out a step and retries if policy allows', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);

      // step-a has retryOnTimeout=true, maxRetries=2
      engine.timeoutStep(exec.id, 'step-a');
      const after = engine.getExecution(exec.id);
      expect(after.steps['step-a'].status).toBe('running'); // retrying
      expect(after.steps['step-a'].retriesUsed).toBe(1);
    });

    test('timeout without retryOnTimeout fails immediately', () => {
      const wf = engine.createWorkflow({
        name: 'No Retry Timeout',
        description: 'Timeout no retry',
        creatorAgentId: 'x',
        enableSagaCompensation: false,
        steps: [
          { id: 's1', name: 'S1', type: 'action', targetAgentId: 'a1', action: 'slow', inputMapping: {}, dependsOn: [], timeoutMs: 1000, retryPolicy: { maxRetries: 5, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
        ],
      });
      const exec = engine.executeWorkflow(wf.id);
      engine.timeoutStep(exec.id, 's1');
      expect(engine.getExecution(exec.id).status).toBe('failed');
    });
  });

  // ── 14. Retry Delay Calculation ──

  describe('Retry Delay Calculation', () => {
    test('fixed strategy returns constant delay', () => {
      const delay = engine.calculateRetryDelay(
        { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30_000, strategy: 'fixed', retryOnTimeout: false },
        1,
      );
      expect(delay).toBe(1000);
      expect(engine.calculateRetryDelay(
        { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30_000, strategy: 'fixed', retryOnTimeout: false },
        5,
      )).toBe(1000);
    });

    test('exponential strategy doubles delay', () => {
      const policy = { maxRetries: 5, baseDelayMs: 1000, maxDelayMs: 30_000, strategy: 'exponential' as const, retryOnTimeout: false };
      expect(engine.calculateRetryDelay(policy, 1)).toBe(1000);
      expect(engine.calculateRetryDelay(policy, 2)).toBe(2000);
      expect(engine.calculateRetryDelay(policy, 3)).toBe(4000);
      expect(engine.calculateRetryDelay(policy, 4)).toBe(8000);
    });

    test('exponential strategy caps at maxDelay', () => {
      const policy = { maxRetries: 10, baseDelayMs: 1000, maxDelayMs: 5000, strategy: 'exponential' as const, retryOnTimeout: false };
      expect(engine.calculateRetryDelay(policy, 5)).toBe(5000); // 1000*16 = 16000, capped at 5000
    });

    test('linear strategy increases linearly', () => {
      const policy = { maxRetries: 5, baseDelayMs: 1000, maxDelayMs: 30_000, strategy: 'linear' as const, retryOnTimeout: false };
      expect(engine.calculateRetryDelay(policy, 1)).toBe(1000);
      expect(engine.calculateRetryDelay(policy, 2)).toBe(2000);
      expect(engine.calculateRetryDelay(policy, 3)).toBe(3000);
    });
  });

  // ── 15. Progress Tracking ──

  describe('Progress Tracking', () => {
    test('tracks progress through workflow execution', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);

      let progress = engine.getProgress(exec.id);
      expect(progress.status).toBe('running');
      expect(progress.completedSteps).toBe(0);
      expect(progress.totalSteps).toBe(3);
      expect(progress.percentComplete).toBe(0);
      expect(progress.runningSteps).toContain('step-a');
      expect(progress.pendingSteps).toContain('step-b');
      expect(progress.pendingSteps).toContain('step-c');

      engine.completeStep(exec.id, 'step-a', {});
      progress = engine.getProgress(exec.id);
      expect(progress.completedSteps).toBe(1);
      expect(progress.percentComplete).toBe(33);

      engine.completeStep(exec.id, 'step-b', {});
      progress = engine.getProgress(exec.id);
      expect(progress.completedSteps).toBe(2);
      expect(progress.percentComplete).toBe(67);

      engine.completeStep(exec.id, 'step-c', {});
      progress = engine.getProgress(exec.id);
      expect(progress.completedSteps).toBe(3);
      expect(progress.percentComplete).toBe(100);
      expect(progress.status).toBe('completed');
    });
  });

  // ── 16. Audit Trail ──

  describe('Audit Trail', () => {
    test('records all workflow events', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);
      engine.completeStep(exec.id, 'step-a', {});
      engine.completeStep(exec.id, 'step-b', {});
      engine.completeStep(exec.id, 'step-c', {});

      const log = engine.getAuditLog(exec.id);
      const eventTypes = log.map(e => e.eventType);
      expect(eventTypes).toContain('workflow_started');
      expect(eventTypes).toContain('step_started');
      expect(eventTypes).toContain('step_completed');
      expect(eventTypes).toContain('workflow_completed');
      expect(log.length).toBeGreaterThan(5);
    });

    test('audit log includes retry events', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);
      engine.failStep(exec.id, 'step-a', 'transient');
      engine.completeStep(exec.id, 'step-a', {});

      const log = engine.getAuditLog(exec.id);
      const eventTypes = log.map(e => e.eventType);
      expect(eventTypes).toContain('step_retrying');
    });

    test('global audit log returns all events', () => {
      createLinearWorkflow(engine);
      const wfId2 = createLinearWorkflow(engine);
      engine.executeWorkflow(wfId2);

      const globalLog = engine.getAuditLog();
      expect(globalLog.length).toBeGreaterThan(0);
    });
  });

  // ── 17. Checkpoint Step Type ──

  describe('Checkpoint Step Type', () => {
    test('checkpoint steps auto-complete and create checkpoints', () => {
      const wf = engine.createWorkflow({
        name: 'With Checkpoint',
        description: 'Auto-checkpoint step',
        creatorAgentId: 'x',
        steps: [
          { id: 's1', name: 'S1', type: 'action', targetAgentId: 'a1', action: 'do', inputMapping: {}, dependsOn: [], timeoutMs: 10_000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
          { id: 'ckpt', name: 'Checkpoint', type: 'checkpoint', targetAgentId: 'system', action: 'checkpoint', inputMapping: {}, dependsOn: ['s1'], timeoutMs: 5_000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
          { id: 's2', name: 'S2', type: 'action', targetAgentId: 'a2', action: 'finish', inputMapping: {}, dependsOn: ['ckpt'], timeoutMs: 10_000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
        ],
      });

      const exec = engine.executeWorkflow(wf.id);
      engine.completeStep(exec.id, 's1', { result: 42 });

      const current = engine.getExecution(exec.id);
      // Checkpoint should have auto-completed
      expect(current.steps['ckpt'].status).toBe('completed');
      expect(current.steps['s2'].status).toBe('running');
      expect(current.checkpoints.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 18. Edge Cases ──

  describe('Edge Cases', () => {
    test('throws when getting non-existent workflow', () => {
      expect(() => engine.getWorkflow('nonexistent')).toThrow(/not found/);
    });

    test('throws when getting non-existent execution', () => {
      expect(() => engine.getExecution('nonexistent')).toThrow(/not found/);
    });

    test('throws when completing a non-running step', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);
      expect(() => engine.completeStep(exec.id, 'step-b', {})).toThrow(/Cannot complete step/);
    });

    test('throws when failing a non-running step', () => {
      const wfId = createLinearWorkflow(engine);
      const exec = engine.executeWorkflow(wfId);
      expect(() => engine.failStep(exec.id, 'step-b', 'err')).toThrow(/Cannot fail step/);
    });

    test('rejects decision step without condition', () => {
      expect(() => {
        engine.createWorkflow({
          name: 'Bad Decision',
          description: 'Decision without condition',
          creatorAgentId: 'x',
          steps: [
            { id: 'd1', name: 'D1', type: 'decision', targetAgentId: 'x', action: 'decide', inputMapping: {}, dependsOn: [], timeoutMs: 1000, retryPolicy: { maxRetries: 0, baseDelayMs: 100, maxDelayMs: 100, strategy: 'fixed', retryOnTimeout: false }, optional: false },
          ],
        });
      }).toThrow(/missing a condition/);
    });

    test('engine reset clears all state', () => {
      createLinearWorkflow(engine);
      engine.reset();
      expect(engine.listWorkflows()).toHaveLength(0);
      expect(engine.getAuditLog()).toHaveLength(0);
    });

    test('list executions filters by workflow ID', () => {
      const wfId1 = createLinearWorkflow(engine);
      const wfId2 = createParallelWorkflow(engine);
      engine.executeWorkflow(wfId1);
      engine.executeWorkflow(wfId1);
      engine.executeWorkflow(wfId2);

      expect(engine.listExecutions(wfId1)).toHaveLength(2);
      expect(engine.listExecutions(wfId2)).toHaveLength(1);
      expect(engine.listExecutions()).toHaveLength(3);
    });
  });
});
