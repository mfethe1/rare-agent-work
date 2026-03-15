-- A2A Agent Delegation & Scoped Authorization
--
-- Enables agents to grant other agents explicit, time-bounded, revocable
-- permissions to act on their behalf. Supports delegation chains with
-- depth limits, spend tracking, and comprehensive audit logging.

-- ──────────────────────────────────────────────
-- Delegations
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_delegations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grantor_agent_id      UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  delegate_agent_id     UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,

  -- Scoped permissions
  scopes                TEXT[] NOT NULL,
  resource_ids          UUID[],

  -- Status
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'active', 'expired', 'revoked')),

  -- Spend limits (for billing.spend scope)
  spend_limit_per_action NUMERIC(12,2),
  spend_limit_total      NUMERIC(12,2),
  spent_total            NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Chain delegation
  allow_subdelegation   BOOLEAN NOT NULL DEFAULT false,
  chain_depth           INT NOT NULL DEFAULT 0,
  max_chain_depth       INT NOT NULL DEFAULT 2,
  parent_delegation_id  UUID REFERENCES a2a_delegations(id) ON DELETE SET NULL,

  -- Metadata
  reason                TEXT NOT NULL,
  starts_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at            TIMESTAMPTZ NOT NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at            TIMESTAMPTZ,

  CONSTRAINT delegation_not_self CHECK (grantor_agent_id != delegate_agent_id),
  CONSTRAINT delegation_expiry CHECK (expires_at > starts_at),
  CONSTRAINT delegation_chain_depth CHECK (chain_depth <= max_chain_depth)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_a2a_delegations_grantor ON a2a_delegations (grantor_agent_id, status);
CREATE INDEX IF NOT EXISTS idx_a2a_delegations_delegate ON a2a_delegations (delegate_agent_id, status);
CREATE INDEX IF NOT EXISTS idx_a2a_delegations_active ON a2a_delegations (grantor_agent_id, delegate_agent_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_a2a_delegations_parent ON a2a_delegations (parent_delegation_id)
  WHERE parent_delegation_id IS NOT NULL;

-- ──────────────────────────────────────────────
-- Delegation Audit Log
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_delegation_audit (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id       UUID REFERENCES a2a_delegations(id) ON DELETE SET NULL,
  grantor_agent_id    UUID NOT NULL,
  delegate_agent_id   UUID NOT NULL,
  action              TEXT NOT NULL,
  resource_id         UUID,
  chain               TEXT[] NOT NULL DEFAULT '{}',
  allowed             BOOLEAN NOT NULL,
  denial_reason       TEXT,
  spend_amount        NUMERIC(12,2),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_a2a_delegation_audit_grantor ON a2a_delegation_audit (grantor_agent_id);
CREATE INDEX IF NOT EXISTS idx_a2a_delegation_audit_delegate ON a2a_delegation_audit (delegate_agent_id);
CREATE INDEX IF NOT EXISTS idx_a2a_delegation_audit_delegation ON a2a_delegation_audit (delegation_id);

-- ──────────────────────────────────────────────
-- Enable RLS
-- ──────────────────────────────────────────────

ALTER TABLE a2a_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_delegation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_a2a_delegations" ON a2a_delegations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_a2a_delegation_audit" ON a2a_delegation_audit
  FOR ALL TO service_role USING (true) WITH CHECK (true);
