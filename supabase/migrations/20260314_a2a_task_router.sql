-- A2A Capability-Based Task Router
-- Adds routing metadata to tasks for audit trail and observability.
-- Supports the POST /api/a2a/tasks/route endpoint.

-- ──────────────────────────────────────────────
-- Add routing_metadata column to a2a_tasks
-- ──────────────────────────────────────────────

ALTER TABLE a2a_tasks
ADD COLUMN IF NOT EXISTS routing_metadata JSONB DEFAULT NULL;

COMMENT ON COLUMN a2a_tasks.routing_metadata IS
  'Stores routing decision details when a task was assigned via capability-based routing. '
  'Includes policy, scores, and matched capability for audit trail.';

-- Index for finding routed tasks efficiently
CREATE INDEX IF NOT EXISTS idx_a2a_tasks_routed
  ON a2a_tasks USING btree ((routing_metadata IS NOT NULL))
  WHERE routing_metadata IS NOT NULL;

-- Index for filtering by routing policy
CREATE INDEX IF NOT EXISTS idx_a2a_tasks_routing_policy
  ON a2a_tasks USING btree (((routing_metadata->>'policy')::text))
  WHERE routing_metadata IS NOT NULL;

-- ──────────────────────────────────────────────
-- Routing analytics view
-- ──────────────────────────────────────────────

CREATE OR REPLACE VIEW a2a_routing_stats AS
SELECT
  routing_metadata->>'policy' AS policy,
  routing_metadata->>'required_capability' AS required_capability,
  COUNT(*) AS total_tasks,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) FILTER (WHERE status IN ('accepted', 'in_progress')) AS pending,
  ROUND(AVG((routing_metadata->>'composite_score')::numeric), 3) AS avg_score,
  MIN(created_at) AS first_routed,
  MAX(created_at) AS last_routed
FROM a2a_tasks
WHERE routing_metadata IS NOT NULL
GROUP BY
  routing_metadata->>'policy',
  routing_metadata->>'required_capability'
ORDER BY total_tasks DESC;

COMMENT ON VIEW a2a_routing_stats IS
  'Aggregated statistics for capability-based task routing. '
  'Shows success rates and average scores by policy and capability.';
