-- Agent Memory & Contextual Continuity Protocol
-- Loop 16: Persistent episodic memory for agents
--
-- Agents need autobiographical memory to learn from experience,
-- carry context across sessions, and share selective memories.

-- ── Memory Banks ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_memory_banks (
  id            TEXT PRIMARY KEY DEFAULT 'bank_' || gen_random_uuid(),
  agent_id      TEXT NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  retention     JSONB NOT NULL DEFAULT '{
    "maxEpisodes": 1000,
    "consolidateAfterHours": 168,
    "purgeAfterHours": 720,
    "autoConsolidate": true
  }'::jsonb,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  episode_count       INT NOT NULL DEFAULT 0,
  consolidation_count INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memory_banks_agent ON a2a_memory_banks(agent_id);

-- ── Episodes ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_episodes (
  id                   TEXT PRIMARY KEY DEFAULT 'ep_' || gen_random_uuid(),
  bank_id              TEXT NOT NULL REFERENCES a2a_memory_banks(id) ON DELETE CASCADE,
  agent_id             TEXT NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  type                 TEXT NOT NULL CHECK (type IN (
    'task_execution', 'interaction', 'observation', 'decision',
    'error_recovery', 'learning', 'feedback', 'collaboration'
  )),
  summary              TEXT NOT NULL,
  content              TEXT NOT NULL,
  context              JSONB NOT NULL DEFAULT '{"involvedAgentIds":[],"metadata":{}}'::jsonb,
  importance           DOUBLE PRECISION NOT NULL DEFAULT 0.5 CHECK (importance BETWEEN 0 AND 1),
  valence              TEXT NOT NULL DEFAULT 'neutral' CHECK (valence IN ('positive','neutral','negative','mixed')),
  tags                 TEXT[] NOT NULL DEFAULT '{}',
  related_episode_ids  TEXT[] NOT NULL DEFAULT '{}',
  consolidated_from    TEXT[] NOT NULL DEFAULT '{}',
  recall_count         INT NOT NULL DEFAULT 0,
  last_recalled_at     TIMESTAMPTZ,
  effective_importance DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_episodes_agent      ON a2a_episodes(agent_id);
CREATE INDEX idx_episodes_bank       ON a2a_episodes(bank_id);
CREATE INDEX idx_episodes_type       ON a2a_episodes(type);
CREATE INDEX idx_episodes_importance ON a2a_episodes(effective_importance DESC);
CREATE INDEX idx_episodes_created    ON a2a_episodes(created_at DESC);
CREATE INDEX idx_episodes_tags       ON a2a_episodes USING gin(tags);

-- Full-text search on summary + content for semantic recall
ALTER TABLE a2a_episodes ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(summary, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) STORED;
CREATE INDEX idx_episodes_fts ON a2a_episodes USING gin(fts);

-- ── Consolidations ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_consolidations (
  id                 TEXT PRIMARY KEY DEFAULT 'cons_' || gen_random_uuid(),
  agent_id           TEXT NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  bank_id            TEXT NOT NULL REFERENCES a2a_memory_banks(id) ON DELETE CASCADE,
  source_episode_ids TEXT[] NOT NULL DEFAULT '{}',
  result_episode_id  TEXT REFERENCES a2a_episodes(id) ON DELETE SET NULL,
  strategy           TEXT NOT NULL CHECK (strategy IN (
    'summarize', 'extract_pattern', 'distill_lesson', 'timeline', 'deduplicate'
  )),
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  summary            TEXT NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at       TIMESTAMPTZ
);

CREATE INDEX idx_consolidations_agent ON a2a_consolidations(agent_id);
CREATE INDEX idx_consolidations_bank  ON a2a_consolidations(bank_id);

-- ── Memory Shares ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_memory_shares (
  id               TEXT PRIMARY KEY DEFAULT 'share_' || gen_random_uuid(),
  from_agent_id    TEXT NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  episode_id       TEXT NOT NULL REFERENCES a2a_episodes(id) ON DELETE CASCADE,
  visibility       TEXT NOT NULL CHECK (visibility IN ('private','specific_agents','organization','public')),
  target_agent_ids TEXT[] NOT NULL DEFAULT '{}',
  redact_fields    TEXT[] NOT NULL DEFAULT '{}',
  expires_at       TIMESTAMPTZ,
  allow_reshare    BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shares_from      ON a2a_memory_shares(from_agent_id);
CREATE INDEX idx_shares_episode   ON a2a_memory_shares(episode_id);
CREATE INDEX idx_shares_targets   ON a2a_memory_shares USING gin(target_agent_ids);
CREATE INDEX idx_shares_visibility ON a2a_memory_shares(visibility);

-- ── Continuity Sessions ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_continuity_sessions (
  id                TEXT PRIMARY KEY DEFAULT 'cont_' || gen_random_uuid(),
  agent_id          TEXT NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  episode_chain     TEXT[] NOT NULL DEFAULT '{}',
  working_context   JSONB NOT NULL DEFAULT '{}'::jsonb,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','completed')),
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_continuity_agent  ON a2a_continuity_sessions(agent_id);
CREATE INDEX idx_continuity_status ON a2a_continuity_sessions(status);

-- ── Materialized view: agent memory stats ─────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS a2a_memory_stats AS
SELECT
  e.agent_id,
  COUNT(*)                         AS total_episodes,
  AVG(e.effective_importance)      AS avg_importance,
  COUNT(DISTINCT e.bank_id)        AS bank_count,
  jsonb_object_agg(e.type, e.cnt) AS episodes_by_type
FROM (
  SELECT agent_id, bank_id, type, effective_importance, COUNT(*) AS cnt
  FROM a2a_episodes
  GROUP BY agent_id, bank_id, type, effective_importance
) e
GROUP BY e.agent_id;

CREATE UNIQUE INDEX idx_memory_stats_agent ON a2a_memory_stats(agent_id);
