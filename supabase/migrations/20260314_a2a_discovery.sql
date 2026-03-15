-- A2A Agent Discovery & Health
-- Adds heartbeat tracking for agent liveness/load and indexes for discovery queries.

-- ──────────────────────────────────────────────
-- Agent Heartbeats Table
-- ──────────────────────────────────────────────
-- One row per agent; upserted on each heartbeat.
-- Stores current load, active task count, and metadata.
CREATE TABLE IF NOT EXISTS agent_heartbeats (
  agent_id        UUID PRIMARY KEY REFERENCES agent_registry(id) ON DELETE CASCADE,
  load            REAL NOT NULL DEFAULT 0 CHECK (load >= 0 AND load <= 1),
  active_tasks    INT NOT NULL DEFAULT 0 CHECK (active_tasks >= 0),
  max_concurrent_tasks INT NOT NULL DEFAULT 1 CHECK (max_concurrent_tasks >= 1),
  status_message  TEXT,
  version         TEXT,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for finding online agents quickly (ordered by recency)
CREATE INDEX IF NOT EXISTS idx_heartbeats_recency
  ON agent_heartbeats (last_heartbeat_at DESC);

-- ──────────────────────────────────────────────
-- Agent Registry Indexes for Discovery
-- ──────────────────────────────────────────────

-- GIN index on capabilities JSONB for capability search
CREATE INDEX IF NOT EXISTS idx_agent_capabilities_gin
  ON agent_registry USING GIN (capabilities jsonb_path_ops);

-- Trigram indexes for free-text search on name and description
-- (requires pg_trgm extension)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_agent_name_trgm
  ON agent_registry USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_agent_description_trgm
  ON agent_registry USING GIN (description gin_trgm_ops);

-- Composite index for common discovery queries (active + trust + recency)
CREATE INDEX IF NOT EXISTS idx_agent_discovery
  ON agent_registry (is_active, trust_level, last_seen_at DESC)
  WHERE is_active = true;
