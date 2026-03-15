-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  A2A Agent Governance Framework                                 ║
-- ║  Autonomy levels, policy engine, escalation, audit, kill switch ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ──────────────────────────────────────────────
-- Governance Policies
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_governance_policies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  agent_id      UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  autonomy_level TEXT NOT NULL CHECK (autonomy_level IN ('observe', 'suggest', 'act_with_approval', 'autonomous')),
  allowed_actions JSONB NOT NULL DEFAULT '[]',
  denied_actions  JSONB NOT NULL DEFAULT '[]',
  allowed_intents JSONB NOT NULL DEFAULT '[]',
  denied_intents  JSONB NOT NULL DEFAULT '[]',
  allowed_targets JSONB NOT NULL DEFAULT '[]',
  denied_targets  JSONB NOT NULL DEFAULT '[]',
  spend_limit     JSONB,
  time_windows    JSONB NOT NULL DEFAULT '[]',
  escalation_target_id UUID NOT NULL,
  priority        INT NOT NULL DEFAULT 100,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_governance_policies_agent ON a2a_governance_policies(agent_id, is_active);
CREATE INDEX idx_governance_policies_priority ON a2a_governance_policies(agent_id, priority DESC);

-- ──────────────────────────────────────────────
-- Escalation Requests
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_governance_escalations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id              UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  action                TEXT NOT NULL,
  intent                TEXT,
  target_agent_id       UUID,
  escalation_target_id  UUID NOT NULL,
  policy_id             TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  reason                TEXT NOT NULL,
  reviewer_rationale    TEXT,
  metadata              JSONB,
  ttl_seconds           INT NOT NULL DEFAULT 3600,
  expires_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at           TIMESTAMPTZ
);

CREATE INDEX idx_governance_escalations_target ON a2a_governance_escalations(escalation_target_id, status);
CREATE INDEX idx_governance_escalations_agent ON a2a_governance_escalations(agent_id, status);

-- ──────────────────────────────────────────────
-- Audit Log (immutable)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_governance_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  action          TEXT NOT NULL,
  decision        TEXT NOT NULL CHECK (decision IN ('allow', 'deny', 'escalate')),
  policy_id       TEXT NOT NULL,
  escalation_id   UUID,
  intent          TEXT,
  target_agent_id UUID,
  reason          TEXT NOT NULL,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No UPDATE or DELETE should ever be performed on audit — it's append-only.
CREATE INDEX idx_governance_audit_agent ON a2a_governance_audit(agent_id, created_at DESC);
CREATE INDEX idx_governance_audit_decision ON a2a_governance_audit(decision, created_at DESC);
CREATE INDEX idx_governance_audit_action ON a2a_governance_audit(action, created_at DESC);

-- ──────────────────────────────────────────────
-- Agent Suspensions (Kill Switch)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_agent_suspensions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  suspended_by      UUID NOT NULL,
  reason            TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'lifted')),
  tasks_cancelled   INT NOT NULL DEFAULT 0,
  workflows_paused  INT NOT NULL DEFAULT 0,
  contracts_frozen  INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  lifted_at         TIMESTAMPTZ,
  lifted_by         UUID,
  lift_reason       TEXT
);

CREATE INDEX idx_agent_suspensions_agent ON a2a_agent_suspensions(agent_id, status);
CREATE INDEX idx_agent_suspensions_active ON a2a_agent_suspensions(status) WHERE status = 'active';

-- ──────────────────────────────────────────────
-- RLS Policies
-- ──────────────────────────────────────────────

ALTER TABLE a2a_governance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_governance_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_governance_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_agent_suspensions ENABLE ROW LEVEL SECURITY;

-- Service role has full access (API routes use service role)
CREATE POLICY governance_policies_service ON a2a_governance_policies FOR ALL USING (true);
CREATE POLICY governance_escalations_service ON a2a_governance_escalations FOR ALL USING (true);
CREATE POLICY governance_audit_service ON a2a_governance_audit FOR ALL USING (true);
CREATE POLICY agent_suspensions_service ON a2a_agent_suspensions FOR ALL USING (true);
