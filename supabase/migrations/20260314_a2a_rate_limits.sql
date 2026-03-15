-- A2A Agent Rate Limiter & Quota System
--
-- Tracks per-agent API usage with sliding window rate limiting.
-- Each action (task submission, context write, etc.) is logged as a row
-- with a timestamp. Rate checks count rows in [now - window, now].
--
-- Old entries are cleaned up by a scheduled job or on-demand function.
-- In a 2028 agentic ecosystem, rate limiting is the foundation of
-- platform trust: agents that respect quotas earn higher trust levels.

-- ──────────────────────────────────────────────
-- Rate Limit Action Log
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_rate_limit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  -- Action category (e.g., 'task.submit', 'context.write')
  action      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE a2a_rate_limit_log IS
  'Sliding-window rate limit log for A2A agent actions. '
  'Each row represents one API call. Rows older than 24h can be pruned.';

-- Primary query pattern: count actions per agent per type in a time window
CREATE INDEX IF NOT EXISTS idx_rate_limit_agent_action_time
  ON a2a_rate_limit_log (agent_id, action, created_at DESC);

-- For cleanup: find rows older than N hours
CREATE INDEX IF NOT EXISTS idx_rate_limit_created
  ON a2a_rate_limit_log (created_at);

-- RLS: service-role only (API routes handle authorization)
ALTER TABLE a2a_rate_limit_log ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- Cleanup Function
-- ──────────────────────────────────────────────
-- Removes rate limit log entries older than 48 hours.
-- Called periodically (e.g., every hour) to keep the table lean.
-- Retains 48h (not 24h) to allow safe daily-cap lookback.

CREATE OR REPLACE FUNCTION cleanup_rate_limit_log(
  retention_hours INTEGER DEFAULT 48
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM a2a_rate_limit_log
  WHERE created_at < now() - (retention_hours || ' hours')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_rate_limit_log(INTEGER) IS
  'Prunes a2a_rate_limit_log entries older than the specified retention period. '
  'Default: 48 hours. Call hourly via pg_cron or application scheduler.';

-- ──────────────────────────────────────────────
-- Usage Summary View (for quick agent lookups)
-- ──────────────────────────────────────────────
-- Provides a snapshot of each agent's action counts in the last hour and day.

CREATE OR REPLACE VIEW a2a_agent_usage_summary AS
SELECT
  ar.id AS agent_id,
  ar.name AS agent_name,
  ar.trust_level,
  rl.action,
  COUNT(*) FILTER (WHERE rl.created_at > now() - INTERVAL '1 minute') AS last_1m,
  COUNT(*) FILTER (WHERE rl.created_at > now() - INTERVAL '1 hour') AS last_1h,
  COUNT(*) AS last_24h
FROM agent_registry ar
JOIN a2a_rate_limit_log rl ON rl.agent_id = ar.id
WHERE rl.created_at > now() - INTERVAL '24 hours'
  AND ar.is_active = true
GROUP BY ar.id, ar.name, ar.trust_level, rl.action
ORDER BY ar.id, rl.action;

COMMENT ON VIEW a2a_agent_usage_summary IS
  'Real-time usage summary per agent per action over the last 24 hours. '
  'Useful for admin dashboards and abuse detection.';
