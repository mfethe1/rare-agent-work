-- A2A Multi-Agent Workflow Orchestrator Schema
--
-- Adds DAG-based workflow definitions and execution tracking.
-- Workflows compose multiple A2A tasks into collaborative pipelines
-- with parallel branches, conditional gates, and retry/fallback logic.

-- ──────────────────────────────────────────────
-- Workflow Definitions (reusable blueprints)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_workflow_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  version       TEXT NOT NULL DEFAULT '1.0.0',
  creator_agent_id UUID NOT NULL REFERENCES agent_registry(id),
  steps         JSONB NOT NULL,
  timeout_seconds INTEGER NOT NULL DEFAULT 3600,
  max_parallelism INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_definitions_creator ON a2a_workflow_definitions(creator_agent_id);

-- ──────────────────────────────────────────────
-- Workflow Executions (running instances)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_workflow_executions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_definition_id  UUID NOT NULL REFERENCES a2a_workflow_definitions(id),
  initiator_agent_id      UUID NOT NULL REFERENCES agent_registry(id),
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timed_out', 'cancelled')),
  input                   JSONB NOT NULL DEFAULT '{}',
  output                  JSONB,
  error                   JSONB,
  steps                   JSONB NOT NULL DEFAULT '[]',
  correlation_id          UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at              TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  deadline                TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_workflow_executions_definition ON a2a_workflow_executions(workflow_definition_id);
CREATE INDEX idx_workflow_executions_initiator ON a2a_workflow_executions(initiator_agent_id);
CREATE INDEX idx_workflow_executions_status ON a2a_workflow_executions(status) WHERE status = 'running';
CREATE INDEX idx_workflow_executions_correlation ON a2a_workflow_executions(correlation_id);
CREATE INDEX idx_workflow_executions_deadline ON a2a_workflow_executions(deadline) WHERE status = 'running';

-- ──────────────────────────────────────────────
-- Link tasks back to workflow steps
-- ──────────────────────────────────────────────
-- Add nullable workflow columns to a2a_tasks so the completion handler
-- can identify which workflow/step a task belongs to.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a2a_tasks' AND column_name = 'workflow_execution_id'
  ) THEN
    ALTER TABLE a2a_tasks ADD COLUMN workflow_execution_id UUID REFERENCES a2a_workflow_executions(id);
    ALTER TABLE a2a_tasks ADD COLUMN workflow_step_id TEXT;
    CREATE INDEX idx_a2a_tasks_workflow ON a2a_tasks(workflow_execution_id) WHERE workflow_execution_id IS NOT NULL;
  END IF;
END
$$;

-- ──────────────────────────────────────────────
-- RLS policies
-- ──────────────────────────────────────────────

ALTER TABLE a2a_workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_workflow_executions ENABLE ROW LEVEL SECURITY;

-- Service role has full access (all A2A operations use service role)
CREATE POLICY workflow_definitions_service ON a2a_workflow_definitions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY workflow_executions_service ON a2a_workflow_executions
  FOR ALL USING (true) WITH CHECK (true);
