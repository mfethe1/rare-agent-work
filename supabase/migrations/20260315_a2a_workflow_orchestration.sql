-- Distributed Agent Workflow Orchestration Protocol
-- Supports DAG-based workflows, saga compensation, circuit breakers,
-- checkpointing, dead letter queues, and full audit trails.

-- ──────────────────────────────────────────────
-- Workflow Definitions
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_workflow_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  creator_agent_id TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]',
  global_timeout_ms BIGINT NOT NULL DEFAULT 3600000,
  enable_saga_compensation BOOLEAN NOT NULL DEFAULT TRUE,
  circuit_breaker_config JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_a2a_workflow_definitions_creator
  ON a2a_workflow_definitions(creator_agent_id);

-- ──────────────────────────────────────────────
-- Workflow Executions
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_workflow_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES a2a_workflow_definitions(id),
  status TEXT NOT NULL DEFAULT 'running',
  steps JSONB NOT NULL DEFAULT '{}',
  context JSONB NOT NULL DEFAULT '{}',
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  circuit_breakers JSONB NOT NULL DEFAULT '{}',
  completed_steps INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms BIGINT
);

CREATE INDEX IF NOT EXISTS idx_a2a_workflow_executions_workflow_id
  ON a2a_workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_a2a_workflow_executions_status
  ON a2a_workflow_executions(status);

-- ──────────────────────────────────────────────
-- Workflow Checkpoints
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_workflow_checkpoints (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES a2a_workflow_executions(id),
  at_step_id TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',
  step_statuses JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_a2a_workflow_checkpoints_execution
  ON a2a_workflow_checkpoints(execution_id);

-- ──────────────────────────────────────────────
-- Dead Letter Queue
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_workflow_dead_letters (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES a2a_workflow_executions(id),
  step_id TEXT NOT NULL,
  error TEXT NOT NULL,
  input JSONB NOT NULL DEFAULT '{}',
  retry_history JSONB NOT NULL DEFAULT '[]',
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_a2a_workflow_dead_letters_execution
  ON a2a_workflow_dead_letters(execution_id);
CREATE INDEX IF NOT EXISTS idx_a2a_workflow_dead_letters_unacked
  ON a2a_workflow_dead_letters(acknowledged) WHERE acknowledged = FALSE;

-- ──────────────────────────────────────────────
-- Audit Log
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_workflow_audit_log (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  step_id TEXT,
  agent_id TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_a2a_workflow_audit_execution
  ON a2a_workflow_audit_log(execution_id);
CREATE INDEX IF NOT EXISTS idx_a2a_workflow_audit_event_type
  ON a2a_workflow_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_a2a_workflow_audit_timestamp
  ON a2a_workflow_audit_log(timestamp);
