/**
 * A2A Multi-Agent Workflow Orchestrator — Type Definitions
 *
 * Defines the DAG-based workflow model that enables complex multi-agent
 * collaboration. A workflow is a directed acyclic graph of steps, where
 * each step delegates to an agent (via capability routing or direct targeting)
 * and passes results downstream.
 *
 * This transforms the A2A platform from "agents that talk to each other"
 * into "agents that think together" — the core primitive for 2028.
 */

// ──────────────────────────────────────────────
// Workflow Definition (the blueprint)
// ──────────────────────────────────────────────

/**
 * A workflow definition is the reusable blueprint that describes
 * a multi-agent collaboration as a DAG of steps.
 */
export interface WorkflowDefinition {
  /** Unique workflow definition ID (UUID). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** What this workflow accomplishes. */
  description: string;
  /** Semantic version for evolution (e.g., "1.0.0"). */
  version: string;
  /** Agent that created this definition. */
  creator_agent_id: string;
  /** The DAG of steps. */
  steps: WorkflowStepDefinition[];
  /** Global workflow timeout in seconds. */
  timeout_seconds: number;
  /** Max concurrent steps (0 = unlimited). */
  max_parallelism: number;
  created_at: string;
  updated_at: string;
}

/**
 * A single step in the workflow DAG.
 *
 * Each step either routes to an agent by capability or targets a specific agent.
 * Steps declare dependencies (other step IDs that must complete first) and
 * can include conditions that gate execution based on prior step results.
 */
export interface WorkflowStepDefinition {
  /** Unique step ID within the workflow (e.g., "research", "summarize"). */
  step_id: string;
  /** Human-readable step name. */
  name: string;
  /** How to find an agent for this step. */
  agent_target: StepAgentTarget;
  /** IDs of steps that must complete before this step can start. */
  depends_on: string[];
  /** Optional condition — if present, step only runs when condition is met. */
  condition?: StepCondition;
  /** Intent/capability to invoke on the target agent. */
  intent: string;
  /**
   * Input template with interpolation support.
   * Use {{steps.<step_id>.result.<path>}} to reference prior step outputs.
   * Use {{workflow.input.<path>}} to reference workflow-level input.
   */
  input_template: Record<string, unknown>;
  /** Step-level timeout override in seconds (falls back to workflow timeout). */
  timeout_seconds?: number;
  /** Retry policy for this step. */
  retry?: StepRetryPolicy;
  /** Fallback step ID to execute if this step fails after all retries. */
  fallback_step_id?: string;
}

/**
 * How to target an agent for a step.
 * - capability: Route via the capability router (platform finds best agent).
 * - direct: Target a specific agent by ID.
 */
export type StepAgentTarget =
  | { type: 'capability'; capability: string; routing_policy?: 'best-match' | 'round-robin' }
  | { type: 'direct'; agent_id: string };

/**
 * Condition that gates whether a step executes.
 * Evaluated against the results of prior completed steps.
 */
export interface StepCondition {
  /** Step ID whose result to evaluate. */
  source_step_id: string;
  /** JSONPath-like field in the result (e.g., "confidence", "category"). */
  field: string;
  /** Comparison operator. */
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'exists';
  /** Value to compare against (not needed for 'exists'). */
  value?: unknown;
}

/**
 * Retry policy for a workflow step.
 */
export interface StepRetryPolicy {
  /** Maximum retry attempts (default: 0 = no retries). */
  max_attempts: number;
  /** Base delay between retries in seconds. */
  delay_seconds: number;
  /** Backoff multiplier (e.g., 2 = exponential doubling). */
  backoff_multiplier: number;
}

// ──────────────────────────────────────────────
// Workflow Execution (a running instance)
// ──────────────────────────────────────────────

export type WorkflowStatus =
  | 'pending'       // Created, not yet started
  | 'running'       // At least one step is in progress
  | 'completed'     // All steps completed successfully
  | 'failed'        // A step failed without fallback
  | 'timed_out'     // Global timeout exceeded
  | 'cancelled';    // Manually cancelled

export type StepStatus =
  | 'pending'       // Waiting for dependencies
  | 'ready'         // Dependencies met, queued for execution
  | 'running'       // Task submitted, awaiting result
  | 'completed'     // Agent returned a result
  | 'failed'        // Agent returned an error (after retries)
  | 'skipped'       // Condition not met, step skipped
  | 'cancelled';    // Workflow cancelled before step ran

/**
 * A running workflow instance.
 */
export interface WorkflowExecution {
  /** Execution ID (UUID). */
  id: string;
  /** Reference to the workflow definition. */
  workflow_definition_id: string;
  /** Agent that triggered this execution. */
  initiator_agent_id: string;
  /** Current execution status. */
  status: WorkflowStatus;
  /** Workflow-level input provided at trigger time. */
  input: Record<string, unknown>;
  /** Aggregated final output (populated on completion). */
  output?: Record<string, unknown>;
  /** Error details if workflow failed. */
  error?: { step_id: string; code: string; message: string };
  /** Per-step execution state. */
  steps: StepExecution[];
  /** Correlation ID for linking all tasks in this workflow. */
  correlation_id: string;
  /** ISO-8601 timestamps. */
  created_at: string;
  started_at?: string;
  completed_at?: string;
  /** Absolute deadline (created_at + timeout_seconds). */
  deadline: string;
}

/**
 * Execution state of a single step within a workflow.
 */
export interface StepExecution {
  /** References the step_id from the definition. */
  step_id: string;
  /** Current step status. */
  status: StepStatus;
  /** The A2A task ID created for this step (once submitted). */
  task_id?: string;
  /** The agent that was assigned this step. */
  assigned_agent_id?: string;
  /** Result from the agent (when completed). */
  result?: Record<string, unknown>;
  /** Error from the agent (when failed). */
  error?: { code: string; message: string };
  /** Number of attempts made. */
  attempts: number;
  started_at?: string;
  completed_at?: string;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/workflows — create a workflow definition. */
export interface CreateWorkflowRequest {
  name: string;
  description: string;
  version?: string;
  steps: WorkflowStepDefinition[];
  timeout_seconds?: number;
  max_parallelism?: number;
}

/** POST /api/a2a/workflows/:id/trigger — start a workflow execution. */
export interface TriggerWorkflowRequest {
  input: Record<string, unknown>;
  /** Override step-level timeouts for this execution. */
  timeout_seconds?: number;
}

/** Response from workflow trigger. */
export interface TriggerWorkflowResponse {
  execution_id: string;
  workflow_id: string;
  status: WorkflowStatus;
  correlation_id: string;
  steps: Array<{ step_id: string; status: StepStatus }>;
  created_at: string;
  deadline: string;
  status_url: string;
}

/** GET /api/a2a/workflows/:id/executions/:execId — execution status. */
export interface WorkflowExecutionResponse {
  execution: WorkflowExecution;
  /** Computed progress (0-1). */
  progress: number;
  /** Steps currently ready/running. */
  active_steps: string[];
  /** Steps waiting on dependencies. */
  blocked_steps: string[];
}
