-- ==========================================================================
-- A2A Event Store & Correlation — Database Schema
-- ==========================================================================
-- Provides the durable, ordered event log that powers the entire A2A reactive
-- backbone, plus correlation infrastructure for tracing causal chains across
-- subsystems.
--
-- Tables:
--   a2a_events                   — Immutable, ordered event log
--   a2a_event_sequence           — Monotonic global sequence counter
--   a2a_event_subscriptions      — How agents declare interest in events
--   a2a_event_delivery_attempts  — Delivery tracking (webhook, SSE, WS)
--   a2a_event_sse_queue          — Polled queue for SSE/WebSocket delivery
--   a2a_event_sse_connections    — Active SSE connection registry
--   a2a_event_dead_letters       — Failed deliveries for manual replay
--   a2a_event_correlations       — Causal links between correlated events
--   a2a_correlation_contexts     — Named correlation contexts (operations)
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- 1. Global sequence counter (monotonic)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS a2a_event_sequence (
  id          TEXT PRIMARY KEY DEFAULT 'global',
  value       BIGINT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the global counter
INSERT INTO a2a_event_sequence (id, value)
VALUES ('global', 0)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Immutable event log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS a2a_events (
  id                TEXT PRIMARY KEY,
  sequence          BIGINT NOT NULL UNIQUE,
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT now(),
  topic             TEXT NOT NULL,
  domain            TEXT NOT NULL,
  action            TEXT NOT NULL,
  source_agent_id   TEXT,
  resource_id       TEXT NOT NULL,
  resource_type     TEXT NOT NULL,
  correlation_id    TEXT,
  trace_context     JSONB,
  data              JSONB NOT NULL DEFAULT '{}',
  schema_version    TEXT NOT NULL DEFAULT '1.0.0',
  idempotency_key   TEXT NOT NULL UNIQUE
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_a2a_events_sequence ON a2a_events (sequence);
CREATE INDEX IF NOT EXISTS idx_a2a_events_topic ON a2a_events (topic);
CREATE INDEX IF NOT EXISTS idx_a2a_events_domain ON a2a_events (domain);
CREATE INDEX IF NOT EXISTS idx_a2a_events_source_agent ON a2a_events (source_agent_id) WHERE source_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_a2a_events_resource ON a2a_events (resource_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_a2a_events_correlation ON a2a_events (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_a2a_events_timestamp ON a2a_events (timestamp);

-- ---------------------------------------------------------------------------
-- 3. Subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS a2a_event_subscriptions (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'paused', 'cancelled', 'suspended')),
  name        TEXT NOT NULL,
  delivery    JSONB NOT NULL,
  filter      JSONB NOT NULL,
  options     JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_a2a_event_subs_agent ON a2a_event_subscriptions (agent_id);
CREATE INDEX IF NOT EXISTS idx_a2a_event_subs_status ON a2a_event_subscriptions (status);

-- ---------------------------------------------------------------------------
-- 4. Delivery attempts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS a2a_event_delivery_attempts (
  id                TEXT PRIMARY KEY,
  subscription_id   TEXT NOT NULL REFERENCES a2a_event_subscriptions(id) ON DELETE CASCADE,
  event_id          TEXT NOT NULL REFERENCES a2a_events(id) ON DELETE CASCADE,
  event_sequence    BIGINT NOT NULL,
  status            TEXT NOT NULL
                    CHECK (status IN ('pending', 'delivered', 'failed', 'retrying', 'dead_lettered', 'expired')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at      TIMESTAMPTZ,
  attempt_count     INTEGER NOT NULL DEFAULT 1,
  next_retry_at     TIMESTAMPTZ,
  last_status_code  INTEGER,
  last_error        TEXT,
  last_latency_ms   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_a2a_delivery_sub ON a2a_event_delivery_attempts (subscription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_a2a_delivery_status ON a2a_event_delivery_attempts (status);
CREATE INDEX IF NOT EXISTS idx_a2a_delivery_retry ON a2a_event_delivery_attempts (next_retry_at)
  WHERE status = 'retrying';

-- ---------------------------------------------------------------------------
-- 5. SSE queue (polled by streaming endpoints)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS a2a_event_sse_queue (
  id                TEXT PRIMARY KEY,
  subscription_id   TEXT NOT NULL REFERENCES a2a_event_subscriptions(id) ON DELETE CASCADE,
  event_id          TEXT NOT NULL,
  event_sequence    BIGINT NOT NULL,
  event_data        JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered         BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_a2a_sse_queue_poll ON a2a_event_sse_queue (subscription_id, delivered, event_sequence)
  WHERE delivered = false;

-- ---------------------------------------------------------------------------
-- 6. SSE connections
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS a2a_event_sse_connections (
  id                    TEXT PRIMARY KEY,
  subscription_id       TEXT NOT NULL REFERENCES a2a_event_subscriptions(id) ON DELETE CASCADE,
  agent_id              TEXT NOT NULL,
  connected_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_event_sequence   BIGINT NOT NULL DEFAULT 0,
  last_heartbeat_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status                TEXT NOT NULL DEFAULT 'connected'
                        CHECK (status IN ('connected', 'disconnected'))
);

CREATE INDEX IF NOT EXISTS idx_a2a_sse_conn_status ON a2a_event_sse_connections (status)
  WHERE status = 'connected';

-- ---------------------------------------------------------------------------
-- 7. Dead-letter queue
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS a2a_event_dead_letters (
  id                TEXT PRIMARY KEY,
  subscription_id   TEXT NOT NULL REFERENCES a2a_event_subscriptions(id) ON DELETE CASCADE,
  event_id          TEXT NOT NULL,
  event             JSONB NOT NULL,
  failed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  failure_reason    TEXT NOT NULL,
  attempt_count     INTEGER NOT NULL,
  replayed          BOOLEAN NOT NULL DEFAULT false,
  replayed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_a2a_dead_letters_sub ON a2a_event_dead_letters (subscription_id, replayed);

-- ---------------------------------------------------------------------------
-- 8. Correlation contexts — named operations that span multiple events
-- ---------------------------------------------------------------------------
-- A correlation context represents a logical operation that produces multiple
-- events across different subsystems. For example, "task execution" generates
-- events in task, contract, billing, and workflow domains. The context gives
-- agents a single handle to trace the entire causal chain.

CREATE TABLE IF NOT EXISTS a2a_correlation_contexts (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  initiator_id    TEXT NOT NULL,           -- agent that started the operation
  root_event_id   TEXT,                    -- first event in the chain
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'failed', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',

  -- Summary statistics (updated as events flow in)
  event_count     INTEGER NOT NULL DEFAULT 0,
  domain_count    INTEGER NOT NULL DEFAULT 0,
  agent_count     INTEGER NOT NULL DEFAULT 0,
  error_count     INTEGER NOT NULL DEFAULT 0,
  duration_ms     BIGINT                   -- set on completion
);

CREATE INDEX IF NOT EXISTS idx_a2a_corr_ctx_initiator ON a2a_correlation_contexts (initiator_id);
CREATE INDEX IF NOT EXISTS idx_a2a_corr_ctx_status ON a2a_correlation_contexts (status);
CREATE INDEX IF NOT EXISTS idx_a2a_corr_ctx_created ON a2a_correlation_contexts (created_at DESC);

-- ---------------------------------------------------------------------------
-- 9. Causal links between events
-- ---------------------------------------------------------------------------
-- Explicit causal edges between events. While correlation_id groups events
-- loosely, causal links express directed causality: "event A caused event B."
-- This enables agents to reconstruct dependency graphs and understand why
-- something happened.

CREATE TABLE IF NOT EXISTS a2a_event_correlations (
  id              TEXT PRIMARY KEY,
  correlation_id  TEXT NOT NULL,            -- groups all events in this operation
  cause_event_id  TEXT NOT NULL REFERENCES a2a_events(id) ON DELETE CASCADE,
  effect_event_id TEXT NOT NULL REFERENCES a2a_events(id) ON DELETE CASCADE,
  relationship    TEXT NOT NULL DEFAULT 'caused'
                  CHECK (relationship IN (
                    'caused',              -- A directly caused B
                    'triggered',           -- A triggered B (indirect)
                    'compensated',         -- B is a compensation/rollback of A
                    'continued',           -- B continues the work of A
                    'branched',            -- B is a parallel branch from A
                    'merged'               -- B merges results from multiple causes
                  )),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata        JSONB NOT NULL DEFAULT '{}',

  UNIQUE (cause_event_id, effect_event_id)
);

CREATE INDEX IF NOT EXISTS idx_a2a_corr_links_correlation ON a2a_event_correlations (correlation_id);
CREATE INDEX IF NOT EXISTS idx_a2a_corr_links_cause ON a2a_event_correlations (cause_event_id);
CREATE INDEX IF NOT EXISTS idx_a2a_corr_links_effect ON a2a_event_correlations (effect_event_id);

-- ---------------------------------------------------------------------------
-- 10. Event retention policy (auto-cleanup via Supabase cron or external job)
-- ---------------------------------------------------------------------------
-- Keeps the event store bounded. Agents that need longer retention should use
-- replay + external archival.

CREATE TABLE IF NOT EXISTS a2a_event_retention_policies (
  id              TEXT PRIMARY KEY DEFAULT 'default',
  max_age_days    INTEGER NOT NULL DEFAULT 90,
  max_events      BIGINT NOT NULL DEFAULT 10000000,
  archive_before  TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO a2a_event_retention_policies (id, max_age_days, max_events)
VALUES ('default', 90, 10000000)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Function: Atomic sequence increment
-- ---------------------------------------------------------------------------
-- Provides a true atomic sequence counter that avoids the race condition
-- in the TypeScript local counter.

CREATE OR REPLACE FUNCTION a2a_next_event_sequence()
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  UPDATE a2a_event_sequence
  SET value = value + 1, updated_at = now()
  WHERE id = 'global'
  RETURNING value INTO next_val;

  RETURN next_val;
END;
$$;

-- ---------------------------------------------------------------------------
-- Function: Update correlation context stats on new event
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION a2a_update_correlation_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.correlation_id IS NOT NULL THEN
    UPDATE a2a_correlation_contexts
    SET
      event_count = event_count + 1,
      updated_at = now(),
      -- Recount distinct domains and agents (lightweight for small correlation groups)
      domain_count = (
        SELECT COUNT(DISTINCT domain) FROM a2a_events
        WHERE correlation_id = NEW.correlation_id
      ),
      agent_count = (
        SELECT COUNT(DISTINCT source_agent_id) FROM a2a_events
        WHERE correlation_id = NEW.correlation_id AND source_agent_id IS NOT NULL
      ),
      error_count = (
        SELECT COUNT(*) FROM a2a_events
        WHERE correlation_id = NEW.correlation_id
          AND action IN ('failed', 'rejected', 'breached', 'timeout', 'step_failed', 'retry_exhausted')
      )
    WHERE id = NEW.correlation_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_a2a_event_correlation_stats
  AFTER INSERT ON a2a_events
  FOR EACH ROW
  EXECUTE FUNCTION a2a_update_correlation_stats();
