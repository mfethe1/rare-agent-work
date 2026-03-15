/**
 * Agent Pipeline Composition Engine — Types
 *
 * In the 2028 agent ecosystem, the most powerful pattern is composing
 * multi-agent data-flow pipelines: "I have data X, I need result Y —
 * find a chain of agent capabilities that transforms X → Y."
 *
 * Current gap: Capabilities have schemas (via versioning) but agents
 * cannot programmatically compose pipelines where one agent's output
 * feeds another's input with type safety. This module adds:
 *
 * - Schema compatibility checking (can output A feed input B?)
 * - Declarative pipeline definitions (ordered capability stages)
 * - Automatic pipeline planning (find a path from schema X to schema Y)
 * - Pipeline execution with per-stage validation and error isolation
 * - Pipeline templates for reusable composition patterns
 */

// ──────────────────────────────────────────────
// Schema Compatibility
// ──────────────────────────────────────────────

/**
 * How compatible two schemas are for data flow.
 *
 * exact      — Output fields are a superset of input required fields with matching types
 * partial    — Some required input fields are satisfied; others need defaults or transforms
 * incompatible — No meaningful overlap; cannot connect without custom adapter
 */
export type SchemaCompatibility = 'exact' | 'partial' | 'incompatible';

/** Result of checking whether one capability's output can feed another's input. */
export interface CompatibilityCheck {
  /** Source capability whose output is being checked. */
  source_capability_id: string;
  source_version?: string;
  /** Target capability whose input is being checked. */
  target_capability_id: string;
  target_version?: string;
  /** Overall compatibility verdict. */
  compatibility: SchemaCompatibility;
  /** Fields from target input that are satisfied by source output. */
  matched_fields: string[];
  /** Required target input fields NOT present in source output. */
  missing_fields: string[];
  /** Fields present in both but with type mismatches. */
  type_mismatches: FieldTypeMismatch[];
  /** 0-1 score: matched_required / total_required. */
  coverage_score: number;
}

export interface FieldTypeMismatch {
  field: string;
  source_type: string;
  target_type: string;
  /** Whether auto-coercion is possible (e.g., number → string). */
  coercible: boolean;
}

// ──────────────────────────────────────────────
// Pipeline Definition
// ──────────────────────────────────────────────

/** Lifecycle of a pipeline definition. */
export type PipelineStatus = 'draft' | 'active' | 'paused' | 'archived';

/** A single stage in a pipeline — maps to one agent capability invocation. */
export interface PipelineStage {
  /** Unique stage ID within the pipeline (e.g., "extract", "summarize"). */
  stage_id: string;
  /** The capability to invoke at this stage. */
  capability_id: string;
  /** Optional: pin to a specific capability version. */
  version?: string;
  /** Optional: route to a specific agent. If omitted, platform routes by capability. */
  agent_id?: string;
  /** Static input fields to merge with the previous stage's output. */
  static_inputs?: Record<string, unknown>;
  /**
   * Field mapping from the previous stage's output to this stage's input.
   * Keys are target input field names, values are source output field paths (dot-notation).
   * If omitted, output is passed through as-is.
   */
  field_map?: Record<string, string>;
  /** Timeout for this stage in seconds (default: 300). */
  timeout_seconds?: number;
  /** Whether to continue the pipeline if this stage fails (default: false). */
  continue_on_failure?: boolean;
  /** Retry policy for this stage. */
  retry?: StageRetryPolicy;
  /** Human-readable description of what this stage does. */
  description?: string;
}

export interface StageRetryPolicy {
  max_attempts: number;
  /** Backoff in seconds between retries. */
  backoff_seconds: number;
}

/** A complete pipeline definition. */
export interface Pipeline {
  /** Platform-assigned pipeline ID (UUID). */
  id: string;
  /** Human-readable pipeline name. */
  name: string;
  /** What this pipeline does. */
  description: string;
  /** Agent that created this pipeline. */
  owner_agent_id: string;
  /** Ordered list of stages (executed sequentially). */
  stages: PipelineStage[];
  /** JSON Schema for the initial pipeline input. */
  input_schema?: Record<string, unknown>;
  /** JSON Schema for the final pipeline output. */
  output_schema?: Record<string, unknown>;
  /** Current lifecycle status. */
  status: PipelineStatus;
  /** Tags for discovery (e.g., ["research", "summarization"]). */
  tags: string[];
  /** Whether other agents can discover and invoke this pipeline. */
  is_public: boolean;
  /** ISO-8601 timestamps. */
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// Pipeline Execution
// ──────────────────────────────────────────────

export type ExecutionStatus =
  | 'pending'      // Created, not yet started
  | 'running'      // Currently executing stages
  | 'completed'    // All stages finished successfully
  | 'failed'       // A stage failed and continue_on_failure was false
  | 'partial'      // Some stages failed but pipeline continued
  | 'cancelled';   // Cancelled by the invoking agent

export type StageExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** Runtime state for a single stage within an execution. */
export interface StageExecution {
  stage_id: string;
  capability_id: string;
  agent_id?: string;
  status: StageExecutionStatus;
  /** The input that was sent to this stage. */
  input?: Record<string, unknown>;
  /** The output produced by this stage. */
  output?: Record<string, unknown>;
  /** Error if stage failed. */
  error?: { code: string; message: string };
  /** Task ID created for this stage (links to A2A task protocol). */
  task_id?: string;
  /** How many attempts were made. */
  attempts: number;
  /** Duration in milliseconds. */
  duration_ms?: number;
  started_at?: string;
  completed_at?: string;
}

/** Runtime state for a full pipeline execution. */
export interface PipelineExecution {
  /** Platform-assigned execution ID (UUID). */
  id: string;
  /** Pipeline definition being executed. */
  pipeline_id: string;
  /** Agent that triggered this execution. */
  invoked_by_agent_id: string;
  /** Overall execution status. */
  status: ExecutionStatus;
  /** Per-stage execution state. */
  stages: StageExecution[];
  /** Initial input provided to the pipeline. */
  input: Record<string, unknown>;
  /** Final output (from the last successful stage). */
  output?: Record<string, unknown>;
  /** Correlation ID for tracing across the A2A ecosystem. */
  correlation_id?: string;
  /** Progress: completed_stages / total_stages. */
  progress: number;
  /** Total duration in milliseconds. */
  duration_ms?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// ──────────────────────────────────────────────
// Pipeline Planning (Auto-Composition)
// ──────────────────────────────────────────────

/** A planned pipeline route discovered by the composition planner. */
export interface PipelinePlan {
  /** Whether a viable path was found. */
  feasible: boolean;
  /** Ordered list of capabilities forming the pipeline. */
  stages: PlannedStage[];
  /** Overall compatibility score (product of per-hop scores). */
  confidence: number;
  /** Fields from the desired output that will be satisfied. */
  output_coverage: string[];
  /** Fields from the desired output that cannot be produced. */
  output_gaps: string[];
  /** Why planning failed (if not feasible). */
  failure_reason?: string;
}

export interface PlannedStage {
  capability_id: string;
  version?: string;
  /** Agents that could fulfill this stage, ranked by score. */
  candidate_agents: PlannedAgent[];
  /** Compatibility with the previous stage. */
  compatibility: SchemaCompatibility;
  coverage_score: number;
}

export interface PlannedAgent {
  agent_id: string;
  agent_name: string;
  reputation_score: number;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/pipelines — create a pipeline. */
export interface PipelineCreateRequest {
  name: string;
  description: string;
  stages: PipelineStage[];
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  tags?: string[];
  is_public?: boolean;
}

export interface PipelineCreateResponse {
  pipeline_id: string;
  name: string;
  status: PipelineStatus;
  stages_count: number;
  /** Per-stage compatibility analysis. */
  compatibility_report: StageCompatibilityReport[];
  created_at: string;
}

export interface StageCompatibilityReport {
  from_stage: string;
  to_stage: string;
  compatibility: SchemaCompatibility;
  coverage_score: number;
  missing_fields: string[];
}

/** POST /api/a2a/pipelines/:id/execute — trigger a pipeline execution. */
export interface PipelineExecuteRequest {
  input: Record<string, unknown>;
  correlation_id?: string;
}

export interface PipelineExecuteResponse {
  execution_id: string;
  pipeline_id: string;
  status: ExecutionStatus;
  progress: number;
  status_url: string;
  created_at: string;
}

/** GET /api/a2a/pipelines/:id/executions/:execId — execution status. */
export interface PipelineExecutionResponse {
  execution: PipelineExecution;
}

/** POST /api/a2a/pipelines/plan — auto-compose a pipeline plan. */
export interface PipelinePlanRequest {
  /** JSON Schema describing the input data you have. */
  input_schema: Record<string, unknown>;
  /** JSON Schema describing the output you want. */
  desired_output_schema: Record<string, unknown>;
  /** Optional: max number of stages (default: 5). */
  max_stages?: number;
  /** Optional: minimum confidence threshold (default: 0.5). */
  min_confidence?: number;
  /** Optional: prefer these capabilities if possible. */
  preferred_capabilities?: string[];
}

export interface PipelinePlanResponse {
  plans: PipelinePlan[];
  /** Number of plans returned (up to 3 ranked by confidence). */
  count: number;
}

/** POST /api/a2a/pipelines/check-compatibility — check schema compatibility. */
export interface SchemaCheckRequest {
  source_capability_id: string;
  source_version?: string;
  target_capability_id: string;
  target_version?: string;
}

export interface SchemaCheckResponse {
  check: CompatibilityCheck;
}

/** GET /api/a2a/pipelines — list pipelines. */
export interface PipelineListResponse {
  pipelines: Pipeline[];
  count: number;
}

/** PATCH /api/a2a/pipelines/:id — update pipeline status. */
export interface PipelineUpdateRequest {
  status?: PipelineStatus;
  name?: string;
  description?: string;
  tags?: string[];
  is_public?: boolean;
}

export interface PipelineUpdateResponse {
  pipeline_id: string;
  status: PipelineStatus;
  updated_at: string;
}

/** POST /api/a2a/pipelines/:id/executions/:execId/cancel — cancel execution. */
export interface PipelineCancelResponse {
  execution_id: string;
  status: 'cancelled';
  stages_completed: number;
  stages_total: number;
}
