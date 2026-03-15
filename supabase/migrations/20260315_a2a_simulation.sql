-- ============================================================================
-- A2A Agent Digital Twin & Multi-Agent Simulation Protocol
-- ============================================================================
-- Loop 19: Simulation environments, digital twins, chaos injection,
-- playbook execution, comparative analysis, and production replay.
-- ============================================================================

-- ──────────────────────────────────────────────
-- Digital Twins
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_simulation_twins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_agent_id UUID NOT NULL REFERENCES a2a_agents(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  behavior      JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'provisioning'
                CHECK (status IN ('provisioning','ready','active','failed','retired')),
  simulation_id UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sim_twins_simulation ON a2a_simulation_twins(simulation_id);
CREATE INDEX IF NOT EXISTS idx_sim_twins_source     ON a2a_simulation_twins(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_sim_twins_status     ON a2a_simulation_twins(status);

-- ──────────────────────────────────────────────
-- Simulation Environments
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_simulations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  created_by    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','provisioning','ready','running','completed','failed','cancelled')),
  twin_ids      JSONB NOT NULL DEFAULT '[]',
  chaos_events  JSONB NOT NULL DEFAULT '[]',
  playbook      JSONB NOT NULL DEFAULT '{}',
  config        JSONB NOT NULL DEFAULT '{}',
  result        JSONB,
  tags          JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_simulations_status     ON a2a_simulations(status);
CREATE INDEX IF NOT EXISTS idx_simulations_created_by ON a2a_simulations(created_by);
CREATE INDEX IF NOT EXISTS idx_simulations_created_at ON a2a_simulations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_simulations_tags       ON a2a_simulations USING gin(tags);

-- ──────────────────────────────────────────────
-- Simulation Comparisons
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_simulation_comparisons (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_simulation_id    UUID NOT NULL REFERENCES a2a_simulations(id) ON DELETE CASCADE,
  candidate_simulation_id   UUID NOT NULL REFERENCES a2a_simulations(id) ON DELETE CASCADE,
  deltas                    JSONB NOT NULL DEFAULT '[]',
  verdict                   TEXT NOT NULL CHECK (verdict IN ('improved','equivalent','degraded','mixed')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sim_comparisons_baseline  ON a2a_simulation_comparisons(baseline_simulation_id);
CREATE INDEX IF NOT EXISTS idx_sim_comparisons_candidate ON a2a_simulation_comparisons(candidate_simulation_id);

-- ──────────────────────────────────────────────
-- RLS Policies
-- ──────────────────────────────────────────────

ALTER TABLE a2a_simulation_twins ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_simulation_comparisons ENABLE ROW LEVEL SECURITY;

-- Service-role full access
CREATE POLICY sim_twins_service ON a2a_simulation_twins
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY simulations_service ON a2a_simulations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY sim_comparisons_service ON a2a_simulation_comparisons
  FOR ALL USING (true) WITH CHECK (true);
