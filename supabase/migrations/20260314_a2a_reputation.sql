-- A2A Dynamic Agent Reputation System
-- Tracks task outcome feedback from requesting agents and computes
-- performance-based reputation scores that feed into routing decisions.
--
-- In a 2028 A2A ecosystem, trust is earned through proven performance,
-- not static labels. This closes the feedback loop between routing
-- and actual task quality.

-- ──────────────────────────────────────────────
-- Task Feedback Table
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_task_feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES a2a_tasks(id) ON DELETE CASCADE,
  reviewer_agent_id UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  target_agent_id   UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  -- Quality rating (1-5): 1=unusable, 2=poor, 3=acceptable, 4=good, 5=excellent
  rating      SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  -- Optional structured feedback
  feedback    JSONB DEFAULT NULL,
  -- The capability/intent that was fulfilled
  intent      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One feedback per task per reviewer
  CONSTRAINT uq_task_feedback UNIQUE (task_id, reviewer_agent_id)
);

COMMENT ON TABLE a2a_task_feedback IS
  'Stores quality ratings from requesting agents after task completion. '
  'Drives the dynamic reputation system for capability-based routing.';

-- Indexes for reputation computation
CREATE INDEX IF NOT EXISTS idx_task_feedback_target
  ON a2a_task_feedback (target_agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_feedback_intent
  ON a2a_task_feedback (target_agent_id, intent);

-- RLS: service-role only (API routes handle authorization)
ALTER TABLE a2a_task_feedback ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- Agent Reputation Materialized View
-- ──────────────────────────────────────────────
-- Precomputed reputation metrics per agent, refreshable on demand.
-- Uses time-weighted scoring: recent feedback matters more.

CREATE MATERIALIZED VIEW IF NOT EXISTS a2a_agent_reputation AS
WITH task_outcomes AS (
  -- Task completion stats from the task table itself
  SELECT
    target_agent_id AS agent_id,
    COUNT(*) AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_tasks,
    COUNT(*) FILTER (WHERE status IN ('accepted', 'in_progress')
      AND created_at + (ttl_seconds * INTERVAL '1 second') < now()) AS expired_tasks,
    -- Average completion time in seconds for completed tasks
    AVG(
      EXTRACT(EPOCH FROM (completed_at - created_at))
    ) FILTER (WHERE status = 'completed') AS avg_completion_seconds
  FROM a2a_tasks
  WHERE target_agent_id IS NOT NULL
  GROUP BY target_agent_id
),
feedback_stats AS (
  -- Quality ratings with time decay (last 30 days weighted 2x vs older)
  SELECT
    target_agent_id AS agent_id,
    COUNT(*) AS total_ratings,
    ROUND(AVG(rating)::numeric, 2) AS avg_rating,
    ROUND(AVG(
      CASE
        WHEN created_at > now() - INTERVAL '30 days' THEN rating * 2.0
        WHEN created_at > now() - INTERVAL '90 days' THEN rating * 1.0
        ELSE rating * 0.5
      END
    ) / NULLIF(AVG(
      CASE
        WHEN created_at > now() - INTERVAL '30 days' THEN 2.0
        WHEN created_at > now() - INTERVAL '90 days' THEN 1.0
        ELSE 0.5
      END
    ), 0)::numeric, 2) AS weighted_avg_rating,
    MIN(created_at) AS first_rating,
    MAX(created_at) AS last_rating
  FROM a2a_task_feedback
  GROUP BY target_agent_id
)
SELECT
  ar.id AS agent_id,
  ar.name AS agent_name,
  ar.trust_level,
  COALESCE(t.total_tasks, 0) AS total_tasks,
  COALESCE(t.completed_tasks, 0) AS completed_tasks,
  COALESCE(t.failed_tasks, 0) AS failed_tasks,
  COALESCE(t.expired_tasks, 0) AS expired_tasks,
  -- Completion rate (0-1)
  CASE
    WHEN COALESCE(t.total_tasks, 0) = 0 THEN 0
    ELSE ROUND(t.completed_tasks::numeric / t.total_tasks, 3)
  END AS completion_rate,
  -- Failure rate (0-1)
  CASE
    WHEN COALESCE(t.total_tasks, 0) = 0 THEN 0
    ELSE ROUND(t.failed_tasks::numeric / t.total_tasks, 3)
  END AS failure_rate,
  ROUND(COALESCE(t.avg_completion_seconds, 0)::numeric, 1) AS avg_completion_seconds,
  COALESCE(f.total_ratings, 0) AS total_ratings,
  COALESCE(f.avg_rating, 0) AS avg_rating,
  COALESCE(f.weighted_avg_rating, 0) AS weighted_avg_rating,
  -- Composite reputation score (0-1):
  --   40% completion rate + 30% quality rating + 20% reliability + 10% volume bonus
  ROUND((
    -- Completion rate component (0-1)
    CASE
      WHEN COALESCE(t.total_tasks, 0) = 0 THEN 0.5  -- Neutral for new agents
      ELSE t.completed_tasks::numeric / t.total_tasks
    END * 0.40
    +
    -- Quality rating component (normalized 0-1 from 1-5 scale)
    CASE
      WHEN COALESCE(f.total_ratings, 0) = 0 THEN 0.5  -- Neutral for unrated agents
      ELSE (f.weighted_avg_rating - 1.0) / 4.0
    END * 0.30
    +
    -- Reliability: inverse of failure+expiry rate
    CASE
      WHEN COALESCE(t.total_tasks, 0) = 0 THEN 0.5
      ELSE 1.0 - LEAST(1.0, (COALESCE(t.failed_tasks, 0) + COALESCE(t.expired_tasks, 0))::numeric / t.total_tasks)
    END * 0.20
    +
    -- Volume bonus: agents with more completed tasks get a small boost (log scale)
    LEAST(0.1, CASE
      WHEN COALESCE(t.completed_tasks, 0) = 0 THEN 0
      ELSE LOG(t.completed_tasks + 1) / 20.0
    END) * 1.0
  )::numeric, 3) AS reputation_score,
  f.last_rating AS last_feedback_at,
  now() AS computed_at
FROM agent_registry ar
LEFT JOIN task_outcomes t ON t.agent_id = ar.id
LEFT JOIN feedback_stats f ON f.agent_id = ar.id
WHERE ar.is_active = true;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_reputation_agent_id
  ON a2a_agent_reputation (agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_reputation_score
  ON a2a_agent_reputation (reputation_score DESC);

COMMENT ON MATERIALIZED VIEW a2a_agent_reputation IS
  'Precomputed dynamic reputation scores for each active agent. '
  'Combines task completion rates, quality ratings, reliability, and volume. '
  'Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY a2a_agent_reputation;';

-- ──────────────────────────────────────────────
-- Helper function to refresh reputation scores
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_agent_reputation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY a2a_agent_reputation;
END;
$$;

COMMENT ON FUNCTION refresh_agent_reputation() IS
  'Refreshes the a2a_agent_reputation materialized view concurrently. '
  'Should be called periodically (e.g., every 5 minutes) or after significant feedback events.';
