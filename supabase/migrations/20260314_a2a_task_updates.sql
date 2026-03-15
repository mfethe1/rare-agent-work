-- ──────────────────────────────────────────────
-- A2A Task Update Support
-- Enables bidirectional agent-to-agent collaboration by allowing
-- assigned agents to update task status and report results.
-- ──────────────────────────────────────────────

-- Index for target_agent_id lookups (PATCH and GET by target agent)
CREATE INDEX IF NOT EXISTS idx_a2a_tasks_target_agent
  ON a2a_tasks (target_agent_id)
  WHERE target_agent_id IS NOT NULL;

-- Track which agent last updated the task (null = platform)
ALTER TABLE a2a_tasks
  ADD COLUMN IF NOT EXISTS updated_by_agent_id uuid REFERENCES agent_registry(id);

-- Comment for documentation
COMMENT ON COLUMN a2a_tasks.updated_by_agent_id IS
  'ID of the agent that last updated this task. NULL when the platform itself made the update.';
