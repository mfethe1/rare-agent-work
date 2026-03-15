-- A2A Agent Metacognition & Recursive Self-Improvement
-- Migration: cognitive profiles, introspection reports, blind spots,
-- strategies, improvement cycles, and improvement propagation

-- ── Cognitive Profiles ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_cognitive_profiles (
  agent_id         UUID PRIMARY KEY REFERENCES a2a_agents(id) ON DELETE CASCADE,
  profile_version  INTEGER NOT NULL DEFAULT 1,
  meta_accuracy    DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  calibration_score DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  introspection_depth INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS a2a_domain_competencies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       UUID NOT NULL REFERENCES a2a_cognitive_profiles(agent_id) ON DELETE CASCADE,
  domain         TEXT NOT NULL,
  proficiency    DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  confidence     DOUBLE PRECISION NOT NULL DEFAULT 0.1,
  sample_size    INTEGER NOT NULL DEFAULT 0,
  trend          TEXT NOT NULL DEFAULT 'stable' CHECK (trend IN ('improving', 'stable', 'declining')),
  last_updated   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, domain)
);

CREATE TABLE IF NOT EXISTS a2a_cognitive_biases (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id           UUID NOT NULL REFERENCES a2a_cognitive_profiles(agent_id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  description        TEXT NOT NULL,
  severity           TEXT NOT NULL CHECK (severity IN ('negligible', 'minor', 'moderate', 'severe', 'critical')),
  frequency          DOUBLE PRECISION NOT NULL DEFAULT 0,
  affected_domains   TEXT[] NOT NULL DEFAULT '{}',
  mitigation_strategy TEXT,
  evidence_task_ids  UUID[] NOT NULL DEFAULT '{}',
  detected_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Failure Patterns ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_failure_patterns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES a2a_cognitive_profiles(agent_id) ON DELETE CASCADE,
  category          TEXT NOT NULL CHECK (category IN (
    'reasoning_error', 'knowledge_gap', 'context_blindness', 'overconfidence',
    'scope_creep', 'hallucination', 'instruction_drift', 'premature_commitment',
    'analysis_paralysis', 'cascade_failure'
  )),
  description       TEXT NOT NULL,
  frequency         DOUBLE PRECISION NOT NULL DEFAULT 1,
  severity          TEXT NOT NULL CHECK (severity IN ('negligible', 'minor', 'moderate', 'severe', 'critical')),
  trigger_conditions TEXT[] NOT NULL DEFAULT '{}',
  example_task_ids  UUID[] NOT NULL DEFAULT '{}',
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'mitigated', 'resolved')),
  mitigation_id     UUID
);

CREATE INDEX IF NOT EXISTS idx_failure_patterns_agent ON a2a_failure_patterns(agent_id);
CREATE INDEX IF NOT EXISTS idx_failure_patterns_status ON a2a_failure_patterns(status);

-- ── Introspection Reports ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_introspection_reports (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id                UUID NOT NULL REFERENCES a2a_cognitive_profiles(agent_id) ON DELETE CASCADE,
  task_id                 UUID NOT NULL,
  task_domain             TEXT NOT NULL,
  outcome                 TEXT NOT NULL CHECK (outcome IN ('success', 'partial_success', 'failure', 'timeout', 'rejected')),
  decision_points         JSONB NOT NULL DEFAULT '[]',
  root_cause              TEXT,
  lessons_learned         TEXT[] NOT NULL DEFAULT '{}',
  confidence_calibration  DOUBLE PRECISION NOT NULL,
  reasoning_efficiency    DOUBLE PRECISION NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_introspection_agent ON a2a_introspection_reports(agent_id);
CREATE INDEX IF NOT EXISTS idx_introspection_domain ON a2a_introspection_reports(task_domain);
CREATE INDEX IF NOT EXISTS idx_introspection_outcome ON a2a_introspection_reports(outcome);

-- ── Blind Spots ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_blind_spots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            UUID NOT NULL REFERENCES a2a_cognitive_profiles(agent_id) ON DELETE CASCADE,
  type                TEXT NOT NULL CHECK (type IN (
    'perceptual', 'reasoning', 'domain', 'adversarial',
    'cultural', 'temporal', 'relational'
  )),
  description         TEXT NOT NULL,
  severity            TEXT NOT NULL CHECK (severity IN ('negligible', 'minor', 'moderate', 'severe', 'critical')),
  confidence          DOUBLE PRECISION NOT NULL,
  evidence            JSONB NOT NULL DEFAULT '[]',
  affected_task_types TEXT[] NOT NULL DEFAULT '{}',
  estimated_impact    DOUBLE PRECISION NOT NULL,
  discovered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  status              TEXT NOT NULL DEFAULT 'suspected' CHECK (status IN ('suspected', 'confirmed', 'addressed', 'false_positive'))
);

CREATE INDEX IF NOT EXISTS idx_blind_spots_agent ON a2a_blind_spots(agent_id);
CREATE INDEX IF NOT EXISTS idx_blind_spots_status ON a2a_blind_spots(status);

-- ── Strategies ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_metacognition_strategies (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id             UUID NOT NULL REFERENCES a2a_cognitive_profiles(agent_id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  description          TEXT NOT NULL,
  target_weakness      UUID NOT NULL,
  approach             TEXT NOT NULL,
  preconditions        TEXT[] NOT NULL DEFAULT '{}',
  expected_improvement DOUBLE PRECISION NOT NULL,
  status               TEXT NOT NULL DEFAULT 'hypothesis' CHECK (status IN (
    'hypothesis', 'testing', 'validated', 'adopted', 'rejected', 'deprecated'
  )),
  alignment_check      JSONB NOT NULL DEFAULT '{}',
  parent_strategy_id   UUID REFERENCES a2a_metacognition_strategies(id),
  generation           INTEGER NOT NULL DEFAULT 1,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS a2a_strategy_test_results (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id              UUID NOT NULL REFERENCES a2a_metacognition_strategies(id) ON DELETE CASCADE,
  test_task_ids            UUID[] NOT NULL DEFAULT '{}',
  control_task_ids         UUID[] NOT NULL DEFAULT '{}',
  improvement_measured     DOUBLE PRECISION NOT NULL,
  statistical_significance DOUBLE PRECISION NOT NULL,
  sample_size              INTEGER NOT NULL,
  side_effects             TEXT[] NOT NULL DEFAULT '{}',
  tested_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategies_agent ON a2a_metacognition_strategies(agent_id);
CREATE INDEX IF NOT EXISTS idx_strategies_status ON a2a_metacognition_strategies(status);

-- ── Improvement Cycles ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_improvement_cycles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id              UUID NOT NULL REFERENCES a2a_cognitive_profiles(agent_id) ON DELETE CASCADE,
  cycle_number          INTEGER NOT NULL,
  phase                 TEXT NOT NULL DEFAULT 'observe' CHECK (phase IN (
    'observe', 'analyze', 'hypothesize', 'test', 'validate', 'adopt', 'monitor'
  )),
  trigger               TEXT NOT NULL CHECK (trigger IN (
    'scheduled', 'performance_drop', 'failure_spike',
    'blind_spot_alert', 'peer_improvement', 'manual'
  )),
  blind_spots_found     UUID[] NOT NULL DEFAULT '{}',
  strategies_generated  UUID[] NOT NULL DEFAULT '{}',
  strategies_adopted    UUID[] NOT NULL DEFAULT '{}',
  strategies_rejected   UUID[] NOT NULL DEFAULT '{}',
  net_improvement       DOUBLE PRECISION NOT NULL DEFAULT 0,
  alignment_violations  INTEGER NOT NULL DEFAULT 0,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cycles_agent ON a2a_improvement_cycles(agent_id);

-- ── Alignment Invariants ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_alignment_invariants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES a2a_cognitive_profiles(agent_id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN (
    'scope_bound', 'safety_floor', 'audit_trail', 'reversibility',
    'human_oversight', 'value_alignment', 'capability_ceiling'
  )),
  description       TEXT NOT NULL,
  constraint_spec   TEXT NOT NULL,
  violation_action  TEXT NOT NULL CHECK (violation_action IN ('block', 'flag', 'rollback', 'alert_human')),
  priority          INTEGER NOT NULL DEFAULT 50
);

-- ── Improvement Propagation ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_improvement_propagations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_agent_id       UUID NOT NULL REFERENCES a2a_agents(id),
  strategy_id           UUID NOT NULL REFERENCES a2a_metacognition_strategies(id),
  strategy_summary      TEXT NOT NULL,
  improvement_magnitude DOUBLE PRECISION NOT NULL,
  applicable_domains    TEXT[] NOT NULL DEFAULT '{}',
  target_agent_ids      UUID[] NOT NULL DEFAULT '{}',
  adopted_by            UUID[] NOT NULL DEFAULT '{}',
  rejected_by           UUID[] NOT NULL DEFAULT '{}',
  status                TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN (
    'pending_review', 'propagating', 'adopted_by_peers', 'rejected_by_peers', 'recalled'
  )),
  provenance_chain      JSONB NOT NULL DEFAULT '[]',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_propagations_source ON a2a_improvement_propagations(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_propagations_status ON a2a_improvement_propagations(status);
