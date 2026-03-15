/**
 * Distributed Agent Workflow Orchestration Protocol -- Types
 *
 * The critical gap in the A2A ecosystem: agents can discover partners,
 * negotiate terms, reach consensus, verify identity, and communicate
 * across platforms -- but they cannot orchestrate complex, multi-step
 * workflows across multiple agents with transactional guarantees.
 *
 * In 2028, agents are the primary operators of mission-critical systems.
 * A supply chain settlement, a multi-party data pipeline, a federated
 * ML training run -- all require reliable, fault-tolerant orchestration
 * where partial failures don't leave the system in an inconsistent state.
 *
 * Without workflow orchestration, agents must:
 *   1. Manually coordinate step ordering (error-prone)
 *   2. Hope nothing fails mid-pipeline (fragile)
 *   3. Have no rollback plan when things go wrong (dangerous)
 *   4. Re-execute entire pipelines on failure (wasteful)
 *
 * The Distributed Agent Workflow Orchestration protocol provides:
 *   1. DAG-based workflow definitions (parallel + sequential steps)
 *   2. Saga pattern with compensation actions (reliable rollback)
 *   3. Checkpoint/resume for long-running workflows
 *   4. Circuit breaker pattern for agent-to-agent calls
 *   5. Conditional branching and dynamic routing
 *   6. Real-time progress tracking and observability
 *   7. Workflow versioning with live migration
 *   8. Timeout and retry policies per step
 *   9. Cross-agent distributed transaction coordination
 *   10. Dead letter queues for unrecoverable failures
 *
 * Workflow lifecycle:
 *   Draft -> Validated -> Running -> Completed | Failed | Compensating | Compensated
 *
 * Step lifecycle:
 *   Pending -> Running -> Completed | Failed | Skipped | Compensating | Compensated
 */

// ──────────────────────────────────────────────
// Workflow Step Types
// ──────────────────────────────────────────────

/**
 * Type of workflow step:
 * - action: Execute a task on a target agent
 * - decision: Evaluate a condition and branch
 * - parallel_gate: Wait for all parallel branches to complete
 * - compensation: A compensating action for rollback
 * - checkpoint: Persist workflow state for recovery
 * - notification: Send a notification without blocking
 */
export type StepType =
  | 'action'
  | 'decision'
  | 'parallel_gate'
  | 'compensation'
  | 'checkpoint'
  | 'notification';

export const STEP_TYPES: StepType[] = [
  'action', 'decision', 'parallel_gate', 'compensation', 'checkpoint', 'notification',
];

/**
 * Status of a workflow step through its lifecycle.
 */
export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'compensating'
  | 'compensated'
  | 'timed_out';

export const STEP_STATUSES: StepStatus[] = [
  'pending', 'running', 'completed', 'failed', 'skipped',
  'compensating', 'compensated', 'timed_out',
];

export const TERMINAL_STEP_STATUSES: StepStatus[] = [
  'completed', 'failed', 'skipped', 'compensated', 'timed_out',
];

/**
 * Status of the overall workflow.
 */
export type WorkflowStatus =
  | 'draft'
  | 'validated'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'compensating'
  | 'compensated'
  | 'cancelled';

export const WORKFLOW_STATUSES: WorkflowStatus[] = [
  'draft', 'validated', 'running', 'paused', 'completed',
  'failed', 'compensating', 'compensated', 'cancelled',
];

export const TERMINAL_WORKFLOW_STATUSES: WorkflowStatus[] = [
  'completed', 'failed', 'compensated', 'cancelled',
];

// ──────────────────────────────────────────────
// Circuit Breaker
// ──────────────────────────────────────────────

/**
 * State of a circuit breaker protecting an agent call:
 * - closed: Normal operation, requests pass through
 * - open: Failures exceeded threshold, requests are rejected
 * - half_open: Testing if the agent has recovered
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export const CIRCUIT_BREAKER_STATES: CircuitBreakerState[] = ['closed', 'open', 'half_open'];

/**
 * Circuit breaker configuration for protecting agent calls.
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold: number;
  /** Time in ms the circuit stays open before trying half-open */
  resetTimeoutMs: number;
  /** Number of successes in half-open state to close the circuit */
  halfOpenSuccessThreshold: number;
}

/**
 * Runtime state of a circuit breaker.
 */
export interface CircuitBreakerStatus {
  /** Target agent the breaker protects */
  targetAgentId: string;
  /** Current state */
  state: CircuitBreakerState;
  /** Consecutive failure count */
  consecutiveFailures: number;
  /** Consecutive successes in half-open state */
  halfOpenSuccesses: number;
  /** When the circuit was last opened (ISO string) */
  lastOpenedAt?: string;
  /** When the circuit was last state-changed (ISO string) */
  lastStateChange: string;
}

// ──────────────────────────────────────────────
// Retry Policy
// ──────────────────────────────────────────────

/**
 * Retry strategy:
 * - fixed: Wait a fixed delay between retries
 * - exponential: Double the delay each retry
 * - linear: Increase delay linearly each retry
 */
export type RetryStrategy = 'fixed' | 'exponential' | 'linear';

export const RETRY_STRATEGIES: RetryStrategy[] = ['fixed', 'exponential', 'linear'];

/**
 * Retry policy for a workflow step.
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries in ms */
  baseDelayMs: number;
  /** Maximum delay cap in ms */
  maxDelayMs: number;
  /** Retry backoff strategy */
  strategy: RetryStrategy;
  /** Whether to retry on timeout in addition to failure */
  retryOnTimeout: boolean;
}

// ──────────────────────────────────────────────
// Workflow Step Definition
// ──────────────────────────────────────────────

/**
 * A condition for decision-type steps.
 * Evaluates an expression against the workflow context.
 */
export interface StepCondition {
  /** Expression to evaluate (JSONPath-like reference to workflow context) */
  expression: string;
  /** Operator to apply */
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'exists';
  /** Value to compare against */
  value: unknown;
  /** Step ID to execute if condition is true */
  trueStepId: string;
  /** Step ID to execute if condition is false */
  falseStepId: string;
}

/**
 * Definition of a single step in a workflow DAG.
 */
export interface WorkflowStepDefinition {
  /** Unique ID within the workflow */
  id: string;
  /** Human-readable name */
  name: string;
  /** Type of step */
  type: StepType;
  /** Agent to execute this step on */
  targetAgentId: string;
  /** The action/task to perform (agent-specific) */
  action: string;
  /** Input parameters for the action */
  inputMapping: Record<string, unknown>;
  /** Step IDs that must complete before this step can run */
  dependsOn: string[];
  /** ID of the compensation step to run if rollback is needed */
  compensationStepId?: string;
  /** Timeout for this step in ms */
  timeoutMs: number;
  /** Retry policy for this step */
  retryPolicy: RetryPolicy;
  /** Condition for decision-type steps */
  condition?: StepCondition;
  /** Whether this step is optional (failure doesn't fail the workflow) */
  optional: boolean;
  /** Arbitrary metadata */
  metadata: Record<string, unknown>;
}

// ──────────────────────────────────────────────
// Workflow Step Runtime
// ──────────────────────────────────────────────

/**
 * A single retry attempt record.
 */
export interface RetryAttempt {
  /** Which attempt number (1-based) */
  attempt: number;
  /** When the attempt started (ISO string) */
  startedAt: string;
  /** When it ended */
  endedAt: string;
  /** Whether it succeeded */
  succeeded: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Runtime state of a workflow step during execution.
 */
export interface WorkflowStepExecution {
  /** References the step definition ID */
  stepId: string;
  /** Current status */
  status: StepStatus;
  /** Output produced by this step */
  output?: Record<string, unknown>;
  /** Error message if failed */
  error?: string;
  /** Number of retries attempted */
  retriesUsed: number;
  /** History of retry attempts */
  retryHistory: RetryAttempt[];
  /** When execution started (ISO string) */
  startedAt?: string;
  /** When execution completed (ISO string) */
  completedAt?: string;
  /** Duration in ms */
  durationMs?: number;
}

// ──────────────────────────────────────────────
// Workflow Definition
// ──────────────────────────────────────────────

/**
 * A complete workflow definition (the blueprint).
 */
export interface WorkflowDefinition {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this workflow does */
  description: string;
  /** Semantic version */
  version: string;
  /** The agent that created this workflow */
  creatorAgentId: string;
  /** All steps in the workflow DAG */
  steps: WorkflowStepDefinition[];
  /** Global timeout for the entire workflow in ms */
  globalTimeoutMs: number;
  /** Whether to auto-compensate on failure (saga pattern) */
  enableSagaCompensation: boolean;
  /** Circuit breaker config for agent calls */
  circuitBreakerConfig: CircuitBreakerConfig;
  /** Arbitrary metadata */
  metadata: Record<string, unknown>;
  /** When created (ISO string) */
  createdAt: string;
  /** When last modified (ISO string) */
  updatedAt: string;
}

// ──────────────────────────────────────────────
// Workflow Execution (Runtime Instance)
// ──────────────────────────────────────────────

/**
 * A checkpoint captures workflow state at a point in time
 * for recovery after crashes or restarts.
 */
export interface WorkflowCheckpoint {
  /** Unique checkpoint ID */
  id: string;
  /** Workflow execution this checkpoint belongs to */
  executionId: string;
  /** Step ID at which the checkpoint was taken */
  atStepId: string;
  /** Serialized workflow context at checkpoint time */
  context: Record<string, unknown>;
  /** Status of all steps at checkpoint time */
  stepStatuses: Record<string, StepStatus>;
  /** When the checkpoint was created (ISO string) */
  createdAt: string;
}

/**
 * Dead letter entry for steps that failed beyond recovery.
 */
export interface DeadLetterEntry {
  /** Unique ID */
  id: string;
  /** Workflow execution ID */
  executionId: string;
  /** Step that failed */
  stepId: string;
  /** The error that caused the dead letter */
  error: string;
  /** Input that was being processed */
  input: Record<string, unknown>;
  /** All retry attempts made */
  retryHistory: RetryAttempt[];
  /** When this was dead-lettered (ISO string) */
  createdAt: string;
  /** Whether an operator has acknowledged this */
  acknowledged: boolean;
}

/**
 * A running or completed workflow execution instance.
 */
export interface WorkflowExecution {
  /** Unique execution ID */
  id: string;
  /** The workflow definition being executed */
  workflowId: string;
  /** Current overall status */
  status: WorkflowStatus;
  /** Runtime state of each step */
  steps: Record<string, WorkflowStepExecution>;
  /** Shared context that flows between steps */
  context: Record<string, unknown>;
  /** Initial input to the workflow */
  input: Record<string, unknown>;
  /** Final output (when completed) */
  output?: Record<string, unknown>;
  /** Checkpoints taken during execution */
  checkpoints: WorkflowCheckpoint[];
  /** Dead-lettered steps */
  deadLetters: DeadLetterEntry[];
  /** Circuit breaker states for each target agent */
  circuitBreakers: Record<string, CircuitBreakerStatus>;
  /** Number of completed steps */
  completedSteps: number;
  /** Total number of steps */
  totalSteps: number;
  /** When execution started (ISO string) */
  startedAt: string;
  /** When execution ended (ISO string) */
  completedAt?: string;
  /** Total duration in ms */
  durationMs?: number;
}

// ──────────────────────────────────────────────
// Workflow Events
// ──────────────────────────────────────────────

export type WorkflowEventType =
  | 'workflow_created'
  | 'workflow_validated'
  | 'workflow_started'
  | 'workflow_paused'
  | 'workflow_resumed'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'workflow_cancelled'
  | 'workflow_compensating'
  | 'workflow_compensated'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'step_retrying'
  | 'step_timed_out'
  | 'step_skipped'
  | 'step_compensating'
  | 'step_compensated'
  | 'checkpoint_created'
  | 'checkpoint_restored'
  | 'circuit_breaker_opened'
  | 'circuit_breaker_half_opened'
  | 'circuit_breaker_closed'
  | 'dead_letter_created';

/**
 * Audit entry for workflow orchestration events.
 */
export interface WorkflowAuditEntry {
  id: string;
  eventType: WorkflowEventType;
  executionId: string;
  workflowId: string;
  stepId?: string;
  agentId?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

// ──────────────────────────────────────────────
// DAG Validation
// ──────────────────────────────────────────────

/**
 * Result of validating a workflow DAG.
 */
export interface DAGValidationResult {
  /** Whether the DAG is valid */
  valid: boolean;
  /** Validation errors found */
  errors: string[];
  /** Warnings that don't prevent execution */
  warnings: string[];
  /** Topological ordering of step IDs (execution order) */
  topologicalOrder: string[];
  /** Sets of step IDs that can run in parallel */
  parallelGroups: string[][];
  /** Steps that have no dependencies (entry points) */
  entryPoints: string[];
  /** Steps that nothing depends on (exit points) */
  exitPoints: string[];
}

// ──────────────────────────────────────────────
// Request/Response Types
// ──────────────────────────────────────────────

export interface CreateWorkflowRequest {
  name: string;
  description: string;
  version?: string;
  creatorAgentId: string;
  steps: Omit<WorkflowStepDefinition, 'metadata'>[];
  globalTimeoutMs?: number;
  enableSagaCompensation?: boolean;
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
  metadata?: Record<string, unknown>;
}

export interface ExecuteWorkflowRequest {
  workflowId: string;
  input?: Record<string, unknown>;
}

export interface ResumeWorkflowRequest {
  executionId: string;
  fromCheckpointId?: string;
}

export interface CompleteStepRequest {
  executionId: string;
  stepId: string;
  output?: Record<string, unknown>;
}

export interface FailStepRequest {
  executionId: string;
  stepId: string;
  error: string;
}
