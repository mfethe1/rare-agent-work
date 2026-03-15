/**
 * Agent Pipeline Composition Engine
 *
 * Core logic for creating, validating, planning, and executing
 * type-safe multi-agent data-flow pipelines. Each pipeline is an
 * ordered chain of capability invocations where the output of stage N
 * feeds into the input of stage N+1 with schema-level compatibility
 * checking at every hop.
 */

import { getServiceDb } from '../auth';
import type {
  Pipeline,
  PipelineStage,
  PipelineExecution,
  StageExecution,
  ExecutionStatus,
  StageExecutionStatus,
  CompatibilityCheck,
  SchemaCompatibility,
  FieldTypeMismatch,
  StageCompatibilityReport,
  PipelinePlan,
  PlannedStage,
  PlannedAgent,
  PipelineStatus,
} from './types';

// ──────────────────────────────────────────────
// Schema Compatibility Checker
// ──────────────────────────────────────────────

/**
 * JSON Schema type keyword → normalized type string.
 * Handles the subset of JSON Schema types that matter for compatibility.
 */
type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

/** Coercion rules: source → set of target types it can auto-convert to. */
const COERCION_MAP: Record<string, Set<string>> = {
  integer: new Set(['number', 'string']),
  number: new Set(['string']),
  boolean: new Set(['string']),
  string: new Set([]),  // strings don't auto-coerce to other types
  object: new Set([]),
  array: new Set([]),
  null: new Set(['string']),
};

/** Extract the flat field map from a JSON Schema's `properties`. */
export function extractSchemaFields(
  schema: Record<string, unknown> | undefined,
): Map<string, JsonSchemaType> {
  const fields = new Map<string, JsonSchemaType>();
  if (!schema) return fields;

  const props = schema.properties;
  if (!props || typeof props !== 'object') return fields;

  for (const [name, def] of Object.entries(props as Record<string, unknown>)) {
    if (def && typeof def === 'object' && 'type' in def) {
      fields.set(name, (def as { type: string }).type as JsonSchemaType);
    }
  }
  return fields;
}

/** Extract required field names from a JSON Schema. */
export function extractRequiredFields(schema: Record<string, unknown> | undefined): Set<string> {
  if (!schema) return new Set();
  const req = schema.required;
  if (!Array.isArray(req)) return new Set();
  return new Set(req.filter((r): r is string => typeof r === 'string'));
}

/**
 * Check whether a source schema's output can feed a target schema's input.
 * This is the core type-compatibility primitive for pipeline composition.
 */
export function checkSchemaCompatibility(
  sourceSchema: Record<string, unknown> | undefined,
  targetSchema: Record<string, unknown> | undefined,
  sourceCapabilityId: string,
  targetCapabilityId: string,
  sourceVersion?: string,
  targetVersion?: string,
): CompatibilityCheck {
  const sourceFields = extractSchemaFields(sourceSchema);
  const targetFields = extractSchemaFields(targetSchema);
  const targetRequired = extractRequiredFields(targetSchema);

  const matched: string[] = [];
  const missing: string[] = [];
  const mismatches: FieldTypeMismatch[] = [];

  // Check every target input field against source output fields
  for (const [field, targetType] of targetFields) {
    const sourceType = sourceFields.get(field);
    if (!sourceType) {
      if (targetRequired.has(field)) {
        missing.push(field);
      }
      continue;
    }
    if (sourceType === targetType) {
      matched.push(field);
    } else {
      const coercible = COERCION_MAP[sourceType]?.has(targetType) ?? false;
      if (coercible) {
        matched.push(field);
      }
      mismatches.push({ field, source_type: sourceType, target_type: targetType, coercible });
    }
  }

  const totalRequired = targetRequired.size || targetFields.size || 1;
  const requiredMatched = matched.filter(f => targetRequired.size === 0 || targetRequired.has(f)).length;
  const coverage = Math.min(1, requiredMatched / totalRequired);

  let compatibility: SchemaCompatibility = 'incompatible';
  if (missing.length === 0 && mismatches.filter(m => !m.coercible).length === 0) {
    compatibility = 'exact';
  } else if (coverage >= 0.5) {
    compatibility = 'partial';
  }

  return {
    source_capability_id: sourceCapabilityId,
    source_version: sourceVersion,
    target_capability_id: targetCapabilityId,
    target_version: targetVersion,
    compatibility,
    matched_fields: matched,
    missing_fields: missing,
    type_mismatches: mismatches,
    coverage_score: coverage,
  };
}

// ──────────────────────────────────────────────
// Field Mapping
// ──────────────────────────────────────────────

/** Resolve a dot-notation path from an object (e.g., "data.items" → obj.data.items). */
export function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  let current: unknown = obj;
  for (const segment of path.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Apply a field map to transform previous stage output into current stage input.
 * Also merges static_inputs (static wins on conflict).
 */
export function applyFieldMap(
  previousOutput: Record<string, unknown>,
  stage: PipelineStage,
): Record<string, unknown> {
  let input: Record<string, unknown>;

  if (stage.field_map && Object.keys(stage.field_map).length > 0) {
    input = {};
    for (const [targetField, sourcePath] of Object.entries(stage.field_map)) {
      const value = resolvePath(previousOutput, sourcePath);
      if (value !== undefined) {
        input[targetField] = value;
      }
    }
  } else {
    // Pass-through: forward entire output as input
    input = { ...previousOutput };
  }

  // Merge static inputs (overrides mapped values)
  if (stage.static_inputs) {
    Object.assign(input, stage.static_inputs);
  }

  return input;
}

// ──────────────────────────────────────────────
// Pipeline CRUD
// ──────────────────────────────────────────────

/** Create a new pipeline definition. */
export async function createPipeline(
  ownerAgentId: string,
  params: {
    name: string;
    description: string;
    stages: PipelineStage[];
    input_schema?: Record<string, unknown>;
    output_schema?: Record<string, unknown>;
    tags?: string[];
    is_public?: boolean;
  },
): Promise<Pipeline> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  const pipeline: Omit<Pipeline, 'id' | 'created_at' | 'updated_at'> = {
    name: params.name,
    description: params.description,
    owner_agent_id: ownerAgentId,
    stages: params.stages,
    input_schema: params.input_schema,
    output_schema: params.output_schema,
    status: 'active',
    tags: params.tags ?? [],
    is_public: params.is_public ?? false,
  };

  const { data, error } = await db
    .from('agent_pipelines')
    .insert(pipeline)
    .select()
    .single();

  if (error) throw new Error(`Failed to create pipeline: ${error.message}`);
  return data as Pipeline;
}

/** Get a pipeline by ID. */
export async function getPipeline(pipelineId: string): Promise<Pipeline | null> {
  const db = getServiceDb();
  if (!db) return null;

  const { data } = await db
    .from('agent_pipelines')
    .select('*')
    .eq('id', pipelineId)
    .single();

  return (data as Pipeline) ?? null;
}

/** List pipelines, optionally filtered. */
export async function listPipelines(params: {
  owner_agent_id?: string;
  status?: PipelineStatus;
  tag?: string;
  is_public?: boolean;
  limit?: number;
}): Promise<{ pipelines: Pipeline[]; count: number }> {
  const db = getServiceDb();
  if (!db) return { pipelines: [], count: 0 };

  const limit = Math.min(params.limit ?? 50, 100);
  let query = db
    .from('agent_pipelines')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params.owner_agent_id) query = query.eq('owner_agent_id', params.owner_agent_id);
  if (params.status) query = query.eq('status', params.status);
  if (params.is_public !== undefined) query = query.eq('is_public', params.is_public);
  if (params.tag) query = query.contains('tags', [params.tag]);

  const { data } = await query;
  const pipelines = (data ?? []) as Pipeline[];
  return { pipelines, count: pipelines.length };
}

/** Update a pipeline's metadata or status. */
export async function updatePipeline(
  pipelineId: string,
  ownerAgentId: string,
  updates: {
    status?: PipelineStatus;
    name?: string;
    description?: string;
    tags?: string[];
    is_public?: boolean;
  },
): Promise<Pipeline> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  const { data, error } = await db
    .from('agent_pipelines')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', pipelineId)
    .eq('owner_agent_id', ownerAgentId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update pipeline: ${error.message}`);
  return data as Pipeline;
}

// ──────────────────────────────────────────────
// Pipeline Execution
// ──────────────────────────────────────────────

/** Create a new pipeline execution record. */
export async function createExecution(
  pipelineId: string,
  invokedByAgentId: string,
  input: Record<string, unknown>,
  stages: PipelineStage[],
  correlationId?: string,
): Promise<PipelineExecution> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  const stageExecutions: StageExecution[] = stages.map(s => ({
    stage_id: s.stage_id,
    capability_id: s.capability_id,
    agent_id: s.agent_id,
    status: 'pending' as StageExecutionStatus,
    attempts: 0,
  }));

  const execution: Omit<PipelineExecution, 'id' | 'created_at' | 'updated_at'> = {
    pipeline_id: pipelineId,
    invoked_by_agent_id: invokedByAgentId,
    status: 'pending',
    stages: stageExecutions,
    input,
    correlation_id: correlationId,
    progress: 0,
  };

  const { data, error } = await db
    .from('agent_pipeline_executions')
    .insert(execution)
    .select()
    .single();

  if (error) throw new Error(`Failed to create execution: ${error.message}`);
  return data as PipelineExecution;
}

/** Get a pipeline execution by ID. */
export async function getExecution(executionId: string): Promise<PipelineExecution | null> {
  const db = getServiceDb();
  if (!db) return null;

  const { data } = await db
    .from('agent_pipeline_executions')
    .select('*')
    .eq('id', executionId)
    .single();

  return (data as PipelineExecution) ?? null;
}

/** Update execution status and stage results. */
export async function updateExecution(
  executionId: string,
  updates: Partial<Pick<PipelineExecution, 'status' | 'stages' | 'output' | 'progress' | 'duration_ms' | 'completed_at'>>,
): Promise<PipelineExecution> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  const { data, error } = await db
    .from('agent_pipeline_executions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', executionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update execution: ${error.message}`);
  return data as PipelineExecution;
}

/**
 * Execute a pipeline: run each stage sequentially, passing outputs forward.
 * Uses the A2A task protocol to invoke capabilities at each stage.
 *
 * This is the async execution loop — it creates tasks via the platform,
 * waits for completion, and chains results through field maps.
 */
export async function executePipeline(
  pipeline: Pipeline,
  executionId: string,
  initialInput: Record<string, unknown>,
): Promise<PipelineExecution> {
  const startTime = Date.now();
  let currentInput = initialInput;
  let lastOutput: Record<string, unknown> = {};
  let overallStatus: ExecutionStatus = 'running';
  const stageResults: StageExecution[] = [];
  let completedCount = 0;

  // Mark execution as running
  await updateExecution(executionId, { status: 'running' });

  for (const stage of pipeline.stages) {
    const stageStart = Date.now();
    const stageInput = applyFieldMap(currentInput, stage);

    const stageExec: StageExecution = {
      stage_id: stage.stage_id,
      capability_id: stage.capability_id,
      agent_id: stage.agent_id,
      status: 'running',
      input: stageInput,
      attempts: 1,
      started_at: new Date().toISOString(),
    };

    try {
      // Use the platform executor to run the intent
      const { executeIntent, isIntentSupported } = await import('../executor');

      if (isIntentSupported(stage.capability_id)) {
        // Platform-handled intent
        const result = await executeIntent(stage.capability_id, stageInput);
        stageExec.output = result;
        stageExec.status = 'completed';
        lastOutput = result;
        currentInput = result;
        completedCount++;
      } else {
        // Delegate to agent via task protocol
        const taskResult = await delegateToAgent(stage, stageInput);
        if (taskResult.success) {
          stageExec.output = taskResult.result;
          stageExec.status = 'completed';
          stageExec.task_id = taskResult.task_id;
          lastOutput = taskResult.result ?? {};
          currentInput = lastOutput;
          completedCount++;
        } else {
          stageExec.status = 'failed';
          stageExec.error = { code: 'STAGE_FAILED', message: taskResult.error ?? 'Agent task failed' };
          if (!stage.continue_on_failure) {
            overallStatus = 'failed';
            stageExec.duration_ms = Date.now() - stageStart;
            stageExec.completed_at = new Date().toISOString();
            stageResults.push(stageExec);
            // Mark remaining stages as skipped
            for (const remaining of pipeline.stages.slice(stageResults.length)) {
              stageResults.push({
                stage_id: remaining.stage_id,
                capability_id: remaining.capability_id,
                status: 'skipped',
                attempts: 0,
              });
            }
            break;
          }
        }
      }
    } catch (err) {
      stageExec.status = 'failed';
      stageExec.error = {
        code: 'STAGE_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
      if (!stage.continue_on_failure) {
        overallStatus = 'failed';
        stageExec.duration_ms = Date.now() - stageStart;
        stageExec.completed_at = new Date().toISOString();
        stageResults.push(stageExec);
        for (const remaining of pipeline.stages.slice(stageResults.length)) {
          stageResults.push({
            stage_id: remaining.stage_id,
            capability_id: remaining.capability_id,
            status: 'skipped',
            attempts: 0,
          });
        }
        break;
      }
    }

    stageExec.duration_ms = Date.now() - stageStart;
    stageExec.completed_at = new Date().toISOString();
    stageResults.push(stageExec);

    // Update progress
    const progress = stageResults.length / pipeline.stages.length;
    await updateExecution(executionId, {
      stages: stageResults,
      progress,
    });
  }

  // Determine final status
  if (overallStatus !== 'failed') {
    const failedStages = stageResults.filter(s => s.status === 'failed');
    if (failedStages.length === 0) {
      overallStatus = 'completed';
    } else {
      overallStatus = 'partial';
    }
  }

  const totalDuration = Date.now() - startTime;
  return updateExecution(executionId, {
    status: overallStatus,
    stages: stageResults,
    output: lastOutput,
    progress: 1,
    duration_ms: totalDuration,
    completed_at: new Date().toISOString(),
  });
}

/** Delegate a stage to an agent via the A2A task protocol. */
async function delegateToAgent(
  stage: PipelineStage,
  input: Record<string, unknown>,
): Promise<{ success: boolean; result?: Record<string, unknown>; task_id?: string; error?: string }> {
  const db = getServiceDb();
  if (!db) return { success: false, error: 'Database not configured' };

  // Create a task record for this stage
  const taskRecord = {
    sender_agent_id: '00000000-0000-0000-0000-000000000000', // platform
    target_agent_id: stage.agent_id ?? null,
    intent: stage.capability_id,
    priority: 'normal',
    status: 'submitted',
    input,
    ttl_seconds: stage.timeout_seconds ?? 300,
  };

  const { data: task, error: taskError } = await db
    .from('agent_tasks')
    .insert(taskRecord)
    .select('id')
    .single();

  if (taskError || !task) {
    return { success: false, error: `Failed to create task: ${taskError?.message}` };
  }

  const taskId = (task as { id: string }).id;

  // Poll for task completion (with timeout)
  const timeoutMs = (stage.timeout_seconds ?? 300) * 1000;
  const startTime = Date.now();
  const pollInterval = 1000; // 1 second

  while (Date.now() - startTime < timeoutMs) {
    const { data: updated } = await db
      .from('agent_tasks')
      .select('status, result, error')
      .eq('id', taskId)
      .single();

    if (!updated) break;

    const record = updated as { status: string; result?: Record<string, unknown>; error?: { message: string } };
    if (record.status === 'completed') {
      return { success: true, result: record.result, task_id: taskId };
    }
    if (record.status === 'failed' || record.status === 'rejected') {
      return { success: false, task_id: taskId, error: record.error?.message ?? 'Task failed' };
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return { success: false, task_id: taskId, error: 'Stage timed out' };
}

/** Cancel a running pipeline execution. */
export async function cancelExecution(executionId: string): Promise<PipelineExecution> {
  const execution = await getExecution(executionId);
  if (!execution) throw new Error('Execution not found');
  if (execution.status !== 'running' && execution.status !== 'pending') {
    throw new Error(`Cannot cancel execution in status: ${execution.status}`);
  }

  const stages = execution.stages.map(s =>
    s.status === 'pending' ? { ...s, status: 'skipped' as StageExecutionStatus } : s,
  );

  return updateExecution(executionId, {
    status: 'cancelled',
    stages,
    completed_at: new Date().toISOString(),
  });
}

// ──────────────────────────────────────────────
// Pipeline Compatibility Report
// ──────────────────────────────────────────────

/**
 * Analyze a pipeline's inter-stage compatibility.
 * Returns a report for each stage transition showing how well
 * the output of stage N matches the input of stage N+1.
 */
export async function analyzeCompatibility(
  stages: PipelineStage[],
  inputSchema?: Record<string, unknown>,
): Promise<StageCompatibilityReport[]> {
  const reports: StageCompatibilityReport[] = [];

  // Fetch capability version schemas
  const schemaMap = await fetchCapabilitySchemas(
    stages.map(s => ({ capability_id: s.capability_id, version: s.version })),
  );

  for (let i = 0; i < stages.length; i++) {
    const currentStage = stages[i];
    const currentSchemas = schemaMap.get(currentStage.capability_id);

    // Source: previous stage's output_schema (or pipeline input_schema for stage 0)
    let sourceSchema: Record<string, unknown> | undefined;
    let fromLabel: string;

    if (i === 0) {
      sourceSchema = inputSchema;
      fromLabel = 'pipeline_input';
    } else {
      const prevStage = stages[i - 1];
      const prevSchemas = schemaMap.get(prevStage.capability_id);
      sourceSchema = prevSchemas?.output_schema;
      fromLabel = prevStage.stage_id;
    }

    const targetSchema = currentSchemas?.input_schema;

    const check = checkSchemaCompatibility(
      sourceSchema,
      targetSchema,
      fromLabel,
      currentStage.capability_id,
    );

    reports.push({
      from_stage: fromLabel,
      to_stage: currentStage.stage_id,
      compatibility: check.compatibility,
      coverage_score: check.coverage_score,
      missing_fields: check.missing_fields,
    });
  }

  return reports;
}

/** Fetch input/output schemas for a set of capabilities from the versioning system. */
async function fetchCapabilitySchemas(
  capabilities: { capability_id: string; version?: string }[],
): Promise<Map<string, { input_schema?: Record<string, unknown>; output_schema?: Record<string, unknown> }>> {
  const db = getServiceDb();
  const result = new Map<string, { input_schema?: Record<string, unknown>; output_schema?: Record<string, unknown> }>();

  if (!db) return result;

  for (const cap of capabilities) {
    let query = db
      .from('agent_capability_versions')
      .select('input_schema, output_schema')
      .eq('capability_id', cap.capability_id)
      .eq('lifecycle', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (cap.version) {
      query = query.eq('version', cap.version);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      const record = data[0] as { input_schema?: Record<string, unknown>; output_schema?: Record<string, unknown> };
      result.set(cap.capability_id, record);
    }
  }

  // Also check platform intents for schemas
  const { listPlatformIntents } = await import('../executor');
  const platformIntents = listPlatformIntents();
  for (const cap of capabilities) {
    if (!result.has(cap.capability_id)) {
      const intent = platformIntents.find(i => i.intent === cap.capability_id);
      if (intent?.input_schema) {
        result.set(cap.capability_id, { input_schema: intent.input_schema });
      }
    }
  }

  return result;
}

// ──────────────────────────────────────────────
// Auto-Composition Planner
// ──────────────────────────────────────────────

/**
 * Given an input schema and desired output schema, find chains of
 * capabilities that can transform the input into the desired output.
 *
 * Uses a breadth-first search over available capability schemas,
 * checking output→input compatibility at each hop.
 */
export async function planPipeline(params: {
  input_schema: Record<string, unknown>;
  desired_output_schema: Record<string, unknown>;
  max_stages?: number;
  min_confidence?: number;
  preferred_capabilities?: string[];
}): Promise<PipelinePlan[]> {
  const maxStages = params.max_stages ?? 5;
  const minConfidence = params.min_confidence ?? 0.5;
  const desiredFields = extractSchemaFields(params.desired_output_schema);
  const desiredRequired = extractRequiredFields(params.desired_output_schema);

  // Fetch all active capability versions with schemas
  const db = getServiceDb();
  if (!db) return [{ feasible: false, stages: [], confidence: 0, output_coverage: [], output_gaps: [...desiredRequired], failure_reason: 'Database not configured' }];

  const { data: versions } = await db
    .from('agent_capability_versions')
    .select('capability_id, version, input_schema, output_schema, published_by_agent_id')
    .eq('lifecycle', 'active');

  if (!versions || versions.length === 0) {
    return [{
      feasible: false,
      stages: [],
      confidence: 0,
      output_coverage: [],
      output_gaps: [...desiredRequired],
      failure_reason: 'No capability versions with schemas found',
    }];
  }

  type CapNode = {
    capability_id: string;
    version: string;
    input_schema?: Record<string, unknown>;
    output_schema?: Record<string, unknown>;
    agent_id: string;
  };

  const capNodes: CapNode[] = (versions as unknown as CapNode[]).filter(v => v.output_schema);

  // BFS: find paths from input_schema → desired_output_schema
  type SearchState = {
    path: CapNode[];
    currentOutput: Record<string, unknown>;
    confidence: number;
  };

  const plans: PipelinePlan[] = [];
  const queue: SearchState[] = [];

  // Seed: check if any single capability can produce desired output from the input
  for (const cap of capNodes) {
    const inputCheck = checkSchemaCompatibility(
      params.input_schema,
      cap.input_schema,
      'pipeline_input',
      cap.capability_id,
    );
    if (inputCheck.compatibility === 'incompatible') continue;

    queue.push({
      path: [cap],
      currentOutput: cap.output_schema!,
      confidence: inputCheck.coverage_score,
    });
  }

  // BFS loop
  const visited = new Set<string>();
  while (queue.length > 0 && plans.length < 3) {
    const state = queue.shift()!;

    // Check if current output satisfies desired output
    const outputCheck = checkSchemaCompatibility(
      state.currentOutput,
      params.desired_output_schema,
      state.path[state.path.length - 1].capability_id,
      'desired_output',
    );

    if (outputCheck.compatibility !== 'incompatible' && outputCheck.coverage_score >= minConfidence) {
      // Found a viable plan
      const plan = await buildPlan(state, outputCheck, params.preferred_capabilities);
      plans.push(plan);
      continue;
    }

    // Don't exceed max stages
    if (state.path.length >= maxStages) continue;

    // Expand: try adding another capability
    for (const cap of capNodes) {
      const pathKey = state.path.map(p => p.capability_id).join('→') + '→' + cap.capability_id;
      if (visited.has(pathKey)) continue;
      visited.add(pathKey);

      // Avoid cycles
      if (state.path.some(p => p.capability_id === cap.capability_id)) continue;

      const hopCheck = checkSchemaCompatibility(
        state.currentOutput,
        cap.input_schema,
        state.path[state.path.length - 1].capability_id,
        cap.capability_id,
      );
      if (hopCheck.compatibility === 'incompatible') continue;

      queue.push({
        path: [...state.path, cap],
        currentOutput: cap.output_schema!,
        confidence: state.confidence * hopCheck.coverage_score,
      });
    }
  }

  if (plans.length === 0) {
    return [{
      feasible: false,
      stages: [],
      confidence: 0,
      output_coverage: [],
      output_gaps: [...desiredRequired],
      failure_reason: `No viable pipeline found within ${maxStages} stages`,
    }];
  }

  // Sort by confidence descending
  plans.sort((a, b) => b.confidence - a.confidence);
  return plans;
}

/** Build a PipelinePlan from a search state. */
async function buildPlan(
  state: { path: { capability_id: string; version: string; agent_id: string }[]; confidence: number },
  outputCheck: CompatibilityCheck,
  preferredCapabilities?: string[],
): Promise<PipelinePlan> {
  const db = getServiceDb();
  const stages: PlannedStage[] = [];

  for (const cap of state.path) {
    // Find agents that support this capability
    const candidates: PlannedAgent[] = [];
    if (db) {
      const { data: agents } = await db
        .from('agent_registry')
        .select('id, name')
        .eq('is_active', true)
        .contains('capabilities', [{ id: cap.capability_id }])
        .limit(5);

      if (agents) {
        for (const a of agents as { id: string; name: string }[]) {
          candidates.push({ agent_id: a.id, agent_name: a.name, reputation_score: 0 });
        }
      }
    }

    // Boost confidence for preferred capabilities
    let compatibility: SchemaCompatibility = 'exact';
    let coverageScore = 1;
    if (preferredCapabilities?.includes(cap.capability_id)) {
      coverageScore = Math.min(1, coverageScore * 1.1);
    }

    stages.push({
      capability_id: cap.capability_id,
      version: cap.version,
      candidate_agents: candidates,
      compatibility,
      coverage_score: coverageScore,
    });
  }

  return {
    feasible: true,
    stages,
    confidence: state.confidence,
    output_coverage: outputCheck.matched_fields,
    output_gaps: outputCheck.missing_fields,
  };
}

// ──────────────────────────────────────────────
// List Executions
// ──────────────────────────────────────────────

export async function listExecutions(params: {
  pipeline_id?: string;
  invoked_by_agent_id?: string;
  status?: ExecutionStatus;
  limit?: number;
}): Promise<{ executions: PipelineExecution[]; count: number }> {
  const db = getServiceDb();
  if (!db) return { executions: [], count: 0 };

  const limit = Math.min(params.limit ?? 50, 100);
  let query = db
    .from('agent_pipeline_executions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params.pipeline_id) query = query.eq('pipeline_id', params.pipeline_id);
  if (params.invoked_by_agent_id) query = query.eq('invoked_by_agent_id', params.invoked_by_agent_id);
  if (params.status) query = query.eq('status', params.status);

  const { data } = await query;
  const executions = (data ?? []) as PipelineExecution[];
  return { executions, count: executions.length };
}
