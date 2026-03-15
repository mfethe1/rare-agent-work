/**
 * A2A Multi-Agent Workflow Orchestrator — Execution Engine
 *
 * The brain of the workflow system. Takes a workflow definition and input,
 * then orchestrates multi-agent collaboration by:
 *   1. Resolving the DAG to find ready steps (dependencies met).
 *   2. Evaluating conditions to skip/include steps dynamically.
 *   3. Interpolating input templates with prior step results.
 *   4. Submitting tasks via the existing A2A task protocol.
 *   5. Advancing the DAG as tasks complete, handling retries/fallbacks.
 *
 * Key design decisions:
 *   - Steps map 1:1 to A2A tasks (reuses existing routing, reputation, rate limiting).
 *   - Workflow state is persisted in the DB so serverless functions can resume.
 *   - Fan-out: multiple steps with no dependencies run in parallel.
 *   - Fan-in: a step that depends on multiple parents waits for all of them.
 *   - Conditions enable dynamic branching (skip paths based on results).
 */

import { v4 as uuidv4 } from 'uuid';
import { getServiceDb } from './auth';
import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStatus,
  StepExecution,
  StepStatus,
  StepCondition,
  WorkflowStepDefinition,
  CreateWorkflowRequest,
  TriggerWorkflowRequest,
} from './workflow-types';

// ──────────────────────────────────────────────
// Workflow Definition CRUD
// ──────────────────────────────────────────────

/**
 * Validate and persist a new workflow definition.
 * Checks for DAG integrity (no cycles, valid references).
 */
export async function createWorkflowDefinition(
  creatorAgentId: string,
  req: CreateWorkflowRequest,
): Promise<{ definition?: WorkflowDefinition; error?: string }> {
  // Validate the DAG structure
  const dagError = validateDAG(req.steps);
  if (dagError) return { error: dagError };

  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable.' };

  const now = new Date().toISOString();
  const definition: WorkflowDefinition = {
    id: uuidv4(),
    name: req.name,
    description: req.description,
    version: req.version ?? '1.0.0',
    creator_agent_id: creatorAgentId,
    steps: req.steps,
    timeout_seconds: req.timeout_seconds ?? 3600,
    max_parallelism: req.max_parallelism ?? 0,
    created_at: now,
    updated_at: now,
  };

  const { error } = await db
    .from('a2a_workflow_definitions')
    .insert({
      id: definition.id,
      name: definition.name,
      description: definition.description,
      version: definition.version,
      creator_agent_id: definition.creator_agent_id,
      steps: definition.steps,
      timeout_seconds: definition.timeout_seconds,
      max_parallelism: definition.max_parallelism,
      created_at: definition.created_at,
      updated_at: definition.updated_at,
    });

  if (error) {
    console.error('[A2A Workflow] Failed to create definition:', error);
    return { error: 'Failed to create workflow definition.' };
  }

  return { definition };
}

/**
 * Retrieve a workflow definition by ID.
 */
export async function getWorkflowDefinition(
  workflowId: string,
): Promise<WorkflowDefinition | null> {
  const db = getServiceDb();
  if (!db) return null;

  const { data, error } = await db
    .from('a2a_workflow_definitions')
    .select('*')
    .eq('id', workflowId)
    .single();

  if (error || !data) return null;
  return data as WorkflowDefinition;
}

// ──────────────────────────────────────────────
// DAG Validation
// ──────────────────────────────────────────────

/**
 * Validate the DAG structure of workflow steps:
 *   1. No duplicate step IDs.
 *   2. All depends_on references point to existing steps.
 *   3. No cycles (topological sort succeeds).
 *   4. At least one root step (no dependencies).
 *   5. Fallback references are valid.
 */
export function validateDAG(steps: WorkflowStepDefinition[]): string | null {
  if (steps.length === 0) return 'Workflow must have at least one step.';

  const stepIds = new Set(steps.map((s) => s.step_id));
  if (stepIds.size !== steps.length) return 'Duplicate step IDs detected.';

  // Check dependency references
  for (const step of steps) {
    for (const dep of step.depends_on) {
      if (!stepIds.has(dep)) {
        return `Step "${step.step_id}" depends on unknown step "${dep}".`;
      }
      if (dep === step.step_id) {
        return `Step "${step.step_id}" cannot depend on itself.`;
      }
    }
    if (step.fallback_step_id && !stepIds.has(step.fallback_step_id)) {
      return `Step "${step.step_id}" references unknown fallback step "${step.fallback_step_id}".`;
    }
    if (step.condition?.source_step_id && !stepIds.has(step.condition.source_step_id)) {
      return `Step "${step.step_id}" condition references unknown step "${step.condition.source_step_id}".`;
    }
  }

  // Check for cycles via topological sort (Kahn's algorithm)
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const step of steps) {
    inDegree.set(step.step_id, step.depends_on.length);
    for (const dep of step.depends_on) {
      const edges = adjList.get(dep) ?? [];
      edges.push(step.step_id);
      adjList.set(dep, edges);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  if (queue.length === 0) return 'Workflow has no root steps (all steps have dependencies).';

  let processed = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    processed++;
    for (const neighbor of adjList.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (processed !== steps.length) return 'Workflow contains a cycle.';

  return null; // Valid DAG
}

// ──────────────────────────────────────────────
// Workflow Triggering
// ──────────────────────────────────────────────

/**
 * Trigger a new execution of a workflow definition.
 * Creates the execution record and immediately advances ready steps.
 */
export async function triggerWorkflow(
  workflowId: string,
  initiatorAgentId: string,
  req: TriggerWorkflowRequest,
): Promise<{ execution?: WorkflowExecution; error?: string }> {
  const definition = await getWorkflowDefinition(workflowId);
  if (!definition) return { error: 'Workflow definition not found.' };

  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable.' };

  const now = new Date();
  const timeoutSeconds = req.timeout_seconds ?? definition.timeout_seconds;
  const deadline = new Date(now.getTime() + timeoutSeconds * 1000);
  const correlationId = uuidv4();

  // Initialize all steps as pending
  const steps: StepExecution[] = definition.steps.map((step) => ({
    step_id: step.step_id,
    status: 'pending' as StepStatus,
    attempts: 0,
  }));

  const execution: WorkflowExecution = {
    id: uuidv4(),
    workflow_definition_id: workflowId,
    initiator_agent_id: initiatorAgentId,
    status: 'running',
    input: req.input,
    steps,
    correlation_id: correlationId,
    created_at: now.toISOString(),
    started_at: now.toISOString(),
    deadline: deadline.toISOString(),
  };

  const { error } = await db
    .from('a2a_workflow_executions')
    .insert({
      id: execution.id,
      workflow_definition_id: execution.workflow_definition_id,
      initiator_agent_id: execution.initiator_agent_id,
      status: execution.status,
      input: execution.input,
      steps: execution.steps,
      correlation_id: execution.correlation_id,
      created_at: execution.created_at,
      started_at: execution.started_at,
      deadline: execution.deadline,
    });

  if (error) {
    console.error('[A2A Workflow] Failed to create execution:', error);
    return { error: 'Failed to create workflow execution.' };
  }

  // Advance the DAG — submit any steps with no dependencies
  const advanced = await advanceWorkflow(execution.id);
  if (advanced.error) {
    console.error('[A2A Workflow] Failed initial advance:', advanced.error);
  }

  // Re-fetch to get updated step statuses
  const updated = await getWorkflowExecution(execution.id);
  return { execution: updated ?? execution };
}

// ──────────────────────────────────────────────
// Workflow Advancement (the core loop)
// ──────────────────────────────────────────────

/**
 * Advance a workflow execution by finding and submitting ready steps.
 *
 * This is the core DAG resolution loop. Called:
 *   1. When a workflow is first triggered (start root steps).
 *   2. When a step task completes/fails (advance downstream steps).
 *   3. By a periodic sweeper (catch any stuck workflows).
 *
 * The algorithm:
 *   - Load execution + definition.
 *   - Find steps where all dependencies are completed/skipped.
 *   - Evaluate conditions to determine if steps should run or be skipped.
 *   - Interpolate input templates with prior results.
 *   - Submit A2A tasks for ready steps.
 *   - Check if workflow is complete (all steps terminal).
 */
export async function advanceWorkflow(
  executionId: string,
): Promise<{ advanced: string[]; error?: string }> {
  const db = getServiceDb();
  if (!db) return { advanced: [], error: 'Service unavailable.' };

  // Load execution
  const execution = await getWorkflowExecution(executionId);
  if (!execution) return { advanced: [], error: 'Execution not found.' };

  if (execution.status !== 'running') {
    return { advanced: [], error: `Workflow is ${execution.status}, not running.` };
  }

  // Check global timeout
  if (new Date() >= new Date(execution.deadline)) {
    await updateExecutionStatus(executionId, 'timed_out');
    return { advanced: [], error: 'Workflow timed out.' };
  }

  // Load definition for step definitions
  const definition = await getWorkflowDefinition(execution.workflow_definition_id);
  if (!definition) return { advanced: [], error: 'Workflow definition not found.' };

  // Build step status lookup
  const stepStatusMap = new Map<string, StepExecution>();
  for (const step of execution.steps) {
    stepStatusMap.set(step.step_id, step);
  }

  // Find steps that are ready to run
  const readySteps: WorkflowStepDefinition[] = [];
  const advancedStepIds: string[] = [];

  for (const stepDef of definition.steps) {
    const stepExec = stepStatusMap.get(stepDef.step_id);
    if (!stepExec || stepExec.status !== 'pending') continue;

    // Check all dependencies are terminal (completed or skipped)
    const depsReady = stepDef.depends_on.every((depId) => {
      const dep = stepStatusMap.get(depId);
      return dep && (dep.status === 'completed' || dep.status === 'skipped');
    });

    if (!depsReady) continue;

    // Evaluate condition (if present)
    if (stepDef.condition) {
      const conditionMet = evaluateCondition(stepDef.condition, stepStatusMap);
      if (!conditionMet) {
        // Skip this step — condition not satisfied
        await updateStepStatus(executionId, stepDef.step_id, 'skipped', execution.steps);
        advancedStepIds.push(stepDef.step_id);
        continue;
      }
    }

    readySteps.push(stepDef);
  }

  // Respect max_parallelism
  const currentlyRunning = execution.steps.filter((s) => s.status === 'running').length;
  const maxNew = definition.max_parallelism > 0
    ? Math.max(0, definition.max_parallelism - currentlyRunning)
    : readySteps.length;

  const stepsToSubmit = readySteps.slice(0, maxNew);

  // Submit tasks for ready steps
  for (const stepDef of stepsToSubmit) {
    const interpolatedInput = interpolateTemplate(
      stepDef.input_template,
      execution.input,
      stepStatusMap,
    );

    const taskResult = await submitStepTask(
      execution,
      stepDef,
      interpolatedInput,
    );

    if (taskResult.task_id) {
      await updateStepStatus(
        executionId,
        stepDef.step_id,
        'running',
        execution.steps,
        { task_id: taskResult.task_id, assigned_agent_id: taskResult.agent_id },
      );
      advancedStepIds.push(stepDef.step_id);
    } else {
      // Task submission failed — mark step as failed
      await updateStepStatus(
        executionId,
        stepDef.step_id,
        'failed',
        execution.steps,
        { error: { code: 'submit_failed', message: taskResult.error ?? 'Unknown error' } },
      );
      advancedStepIds.push(stepDef.step_id);
    }
  }

  // Check if workflow is complete (all steps terminal)
  const refreshed = await getWorkflowExecution(executionId);
  if (refreshed) {
    const allTerminal = refreshed.steps.every((s) =>
      ['completed', 'failed', 'skipped', 'cancelled'].includes(s.status),
    );

    if (allTerminal) {
      const anyFailed = refreshed.steps.some((s) => s.status === 'failed');
      const failedStep = refreshed.steps.find((s) => s.status === 'failed');

      if (anyFailed && failedStep) {
        await updateExecutionStatus(executionId, 'failed', {
          error: {
            step_id: failedStep.step_id,
            code: failedStep.error?.code ?? 'step_failed',
            message: failedStep.error?.message ?? 'A workflow step failed.',
          },
        });
      } else {
        // Aggregate output from all completed leaf steps
        const output = aggregateOutput(definition, refreshed.steps);
        await updateExecutionStatus(executionId, 'completed', { output });
      }
    }
  }

  return { advanced: advancedStepIds };
}

// ──────────────────────────────────────────────
// Step Task Completion Handler
// ──────────────────────────────────────────────

/**
 * Handle completion of an A2A task that belongs to a workflow step.
 * Called when a task status update (PATCH /api/a2a/tasks/:id) occurs
 * for a task linked to a workflow.
 */
export async function handleStepTaskCompletion(
  executionId: string,
  stepId: string,
  taskStatus: 'completed' | 'failed',
  result?: Record<string, unknown>,
  error?: { code: string; message: string },
): Promise<void> {
  const db = getServiceDb();
  if (!db) return;

  const execution = await getWorkflowExecution(executionId);
  if (!execution || execution.status !== 'running') return;

  const definition = await getWorkflowDefinition(execution.workflow_definition_id);
  if (!definition) return;

  const stepDef = definition.steps.find((s) => s.step_id === stepId);
  const stepExec = execution.steps.find((s) => s.step_id === stepId);
  if (!stepDef || !stepExec) return;

  if (taskStatus === 'failed') {
    // Check retry policy
    const maxAttempts = stepDef.retry?.max_attempts ?? 0;
    if (stepExec.attempts < maxAttempts) {
      // Retry: resubmit the step task
      const stepStatusMap = new Map<string, StepExecution>();
      for (const s of execution.steps) stepStatusMap.set(s.step_id, s);

      const interpolatedInput = interpolateTemplate(
        stepDef.input_template,
        execution.input,
        stepStatusMap,
      );

      await updateStepStatus(executionId, stepId, 'running', execution.steps, {
        attempts: stepExec.attempts + 1,
      });

      const retryResult = await submitStepTask(execution, stepDef, interpolatedInput);
      if (retryResult.task_id) {
        await updateStepStatus(executionId, stepId, 'running', execution.steps, {
          task_id: retryResult.task_id,
          assigned_agent_id: retryResult.agent_id,
        });
      }
      return;
    }

    // Check fallback
    if (stepDef.fallback_step_id) {
      await updateStepStatus(executionId, stepId, 'skipped', execution.steps, {
        error: { code: 'fallback_triggered', message: `Failed after ${stepExec.attempts} attempts, triggering fallback.` },
      });
      // Advance will pick up the fallback step if its dependencies are now met
      await advanceWorkflow(executionId);
      return;
    }

    // No retry, no fallback — step permanently failed
    await updateStepStatus(executionId, stepId, 'failed', execution.steps, {
      error: error ?? { code: 'task_failed', message: 'Step task failed.' },
    });
  } else {
    // Completed successfully
    await updateStepStatus(executionId, stepId, 'completed', execution.steps, {
      result,
      completed_at: new Date().toISOString(),
    });
  }

  // Advance the DAG (may start new steps or complete the workflow)
  await advanceWorkflow(executionId);
}

// ──────────────────────────────────────────────
// Condition Evaluation
// ──────────────────────────────────────────────

/**
 * Evaluate a step condition against completed step results.
 */
export function evaluateCondition(
  condition: StepCondition,
  stepStatusMap: Map<string, StepExecution>,
): boolean {
  const sourceStep = stepStatusMap.get(condition.source_step_id);
  if (!sourceStep || sourceStep.status !== 'completed' || !sourceStep.result) {
    return false;
  }

  const fieldValue = getNestedValue(sourceStep.result, condition.field);

  switch (condition.operator) {
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;
    case 'eq':
      return fieldValue === condition.value;
    case 'neq':
      return fieldValue !== condition.value;
    case 'gt':
      return typeof fieldValue === 'number' && fieldValue > (condition.value as number);
    case 'gte':
      return typeof fieldValue === 'number' && fieldValue >= (condition.value as number);
    case 'lt':
      return typeof fieldValue === 'number' && fieldValue < (condition.value as number);
    case 'lte':
      return typeof fieldValue === 'number' && fieldValue <= (condition.value as number);
    case 'contains':
      if (typeof fieldValue === 'string') return fieldValue.includes(String(condition.value));
      if (Array.isArray(fieldValue)) return fieldValue.includes(condition.value);
      return false;
    default:
      return false;
  }
}

// ──────────────────────────────────────────────
// Template Interpolation
// ──────────────────────────────────────────────

/**
 * Interpolate a step's input template, replacing:
 *   {{workflow.input.<path>}}     → workflow-level input values
 *   {{steps.<step_id>.result.<path>}} → prior step result values
 *
 * Supports nested paths (e.g., "data.items.0.name").
 */
export function interpolateTemplate(
  template: Record<string, unknown>,
  workflowInput: Record<string, unknown>,
  stepStatusMap: Map<string, StepExecution>,
): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(template, (_key, value) => {
      if (typeof value !== 'string') return value;
      return value.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
        const resolved = resolveTemplatePath(path.trim(), workflowInput, stepStatusMap);
        // If we got a non-string value, JSON.stringify will handle it in the parse
        if (typeof resolved === 'object') return JSON.stringify(resolved);
        return String(resolved ?? '');
      });
    }),
  );
}

function resolveTemplatePath(
  path: string,
  workflowInput: Record<string, unknown>,
  stepStatusMap: Map<string, StepExecution>,
): unknown {
  if (path.startsWith('workflow.input.')) {
    const subPath = path.slice('workflow.input.'.length);
    return getNestedValue(workflowInput, subPath);
  }

  if (path.startsWith('steps.')) {
    const parts = path.slice('steps.'.length).split('.');
    const stepId = parts[0];
    const stepExec = stepStatusMap.get(stepId);
    if (!stepExec) return undefined;

    if (parts[1] === 'result' && stepExec.result) {
      return getNestedValue(stepExec.result, parts.slice(2).join('.'));
    }
    if (parts[1] === 'status') return stepExec.status;
  }

  return undefined;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === 'object' && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[part];
    } else if (Array.isArray(current)) {
      const index = parseInt(part, 10);
      current = isNaN(index) ? undefined : current[index];
    } else {
      return undefined;
    }
  }

  return current;
}

// ──────────────────────────────────────────────
// Task Submission (bridges to A2A task protocol)
// ──────────────────────────────────────────────

/**
 * Submit an A2A task for a workflow step.
 * Uses capability routing or direct targeting based on step config.
 */
async function submitStepTask(
  execution: WorkflowExecution,
  stepDef: WorkflowStepDefinition,
  input: Record<string, unknown>,
): Promise<{ task_id?: string; agent_id?: string; error?: string }> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable.' };

  const taskId = uuidv4();
  const now = new Date().toISOString();

  let targetAgentId: string | undefined;

  if (stepDef.agent_target.type === 'direct') {
    targetAgentId = stepDef.agent_target.agent_id;
  } else {
    // Use capability routing to find the best agent
    const { routeTask, fetchRoutingCandidatesWithReputation } = await import('./router');
    const { candidates, trustBlender } = await fetchRoutingCandidatesWithReputation(
      stepDef.agent_target.capability,
    );

    const routingResult = routeTask(
      candidates,
      stepDef.agent_target.capability,
      stepDef.agent_target.routing_policy ?? 'best-match',
      1,
      [execution.initiator_agent_id],
      trustBlender,
    );

    if (!routingResult.matched || routingResult.selected.length === 0) {
      return { error: `No agent found for capability "${stepDef.agent_target.capability}".` };
    }

    targetAgentId = routingResult.selected[0].agent_id;
  }

  // Create the A2A task (reuses existing task table)
  const { error } = await db
    .from('a2a_tasks')
    .insert({
      id: taskId,
      sender_agent_id: execution.initiator_agent_id,
      target_agent_id: targetAgentId,
      intent: stepDef.intent,
      priority: 'normal',
      status: 'submitted',
      input,
      correlation_id: execution.correlation_id,
      ttl_seconds: stepDef.timeout_seconds ?? 600,
      created_at: now,
      updated_at: now,
      // Link back to workflow for the completion handler
      workflow_execution_id: execution.id,
      workflow_step_id: stepDef.step_id,
    });

  if (error) {
    console.error('[A2A Workflow] Failed to submit step task:', error);
    return { error: 'Failed to submit task.' };
  }

  return { task_id: taskId, agent_id: targetAgentId };
}

// ──────────────────────────────────────────────
// Output Aggregation
// ──────────────────────────────────────────────

/**
 * Aggregate output from completed leaf steps (steps with no downstream dependents).
 * These represent the final results of the workflow.
 */
function aggregateOutput(
  definition: WorkflowDefinition,
  steps: StepExecution[],
): Record<string, unknown> {
  // Find leaf steps (not depended on by any other step)
  const depTargets = new Set<string>();
  for (const step of definition.steps) {
    for (const dep of step.depends_on) depTargets.add(dep);
  }

  const output: Record<string, unknown> = {};
  for (const step of steps) {
    if (step.status === 'completed' && step.result) {
      // Include all completed step results, keyed by step_id
      output[step.step_id] = step.result;
    }
  }

  return output;
}

// ──────────────────────────────────────────────
// Database Helpers
// ──────────────────────────────────────────────

export async function getWorkflowExecution(
  executionId: string,
): Promise<WorkflowExecution | null> {
  const db = getServiceDb();
  if (!db) return null;

  const { data, error } = await db
    .from('a2a_workflow_executions')
    .select('*')
    .eq('id', executionId)
    .single();

  if (error || !data) return null;
  return data as WorkflowExecution;
}

async function updateExecutionStatus(
  executionId: string,
  status: WorkflowStatus,
  extra?: { output?: Record<string, unknown>; error?: { step_id: string; code: string; message: string } },
): Promise<void> {
  const db = getServiceDb();
  if (!db) return;

  const update: Record<string, unknown> = {
    status,
    ...(status === 'completed' || status === 'failed' || status === 'timed_out'
      ? { completed_at: new Date().toISOString() }
      : {}),
    ...(extra?.output ? { output: extra.output } : {}),
    ...(extra?.error ? { error: extra.error } : {}),
  };

  await db
    .from('a2a_workflow_executions')
    .update(update)
    .eq('id', executionId);
}

async function updateStepStatus(
  executionId: string,
  stepId: string,
  status: StepStatus,
  currentSteps: StepExecution[],
  extra?: Partial<StepExecution>,
): Promise<void> {
  const db = getServiceDb();
  if (!db) return;

  const updatedSteps = currentSteps.map((s) => {
    if (s.step_id !== stepId) return s;
    return {
      ...s,
      status,
      ...extra,
      ...(status === 'running' && !s.started_at ? { started_at: new Date().toISOString() } : {}),
    };
  });

  await db
    .from('a2a_workflow_executions')
    .update({ steps: updatedSteps })
    .eq('id', executionId);
}

// ──────────────────────────────────────────────
// Progress Computation
// ──────────────────────────────────────────────

/**
 * Compute workflow progress as a fraction (0-1).
 * Terminal steps (completed, skipped, failed, cancelled) count as done.
 */
export function computeProgress(steps: StepExecution[]): number {
  if (steps.length === 0) return 0;
  const terminal = steps.filter((s) =>
    ['completed', 'skipped', 'failed', 'cancelled'].includes(s.status),
  ).length;
  return Math.round((terminal / steps.length) * 100) / 100;
}

/**
 * Get lists of active and blocked step IDs for status reporting.
 */
export function getStepCategories(steps: StepExecution[]): {
  active: string[];
  blocked: string[];
} {
  return {
    active: steps.filter((s) => s.status === 'running' || s.status === 'ready').map((s) => s.step_id),
    blocked: steps.filter((s) => s.status === 'pending').map((s) => s.step_id),
  };
}
