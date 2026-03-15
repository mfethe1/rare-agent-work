-- Agent Service Contracts: SLAs, pricing, negotiation, and breach detection
-- Part of the A2A ecosystem — enables formal service agreements between agents.

-- ──────────────────────────────────────────────
-- Service Contracts
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_service_contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_agent_id UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  consumer_agent_id UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  capabilities    JSONB NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'proposed'
                    CHECK (status IN ('proposed', 'negotiating', 'active', 'completed', 'terminated', 'breached')),
  sla             JSONB NOT NULL DEFAULT '{}',
  pricing         JSONB NOT NULL DEFAULT '{}',
  starts_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL,
  duration_days   INTEGER NOT NULL DEFAULT 30,
  negotiation_rounds    INTEGER NOT NULL DEFAULT 0,
  max_negotiation_rounds INTEGER NOT NULL DEFAULT 5,
  last_proposed_by      UUID NOT NULL REFERENCES agent_registry(id),
  termination_reason    TEXT,
  compliance      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- An agent cannot contract with itself
  CONSTRAINT no_self_contract CHECK (provider_agent_id != consumer_agent_id)
);

-- Indexes for common query patterns
CREATE INDEX idx_contracts_provider ON a2a_service_contracts(provider_agent_id, status);
CREATE INDEX idx_contracts_consumer ON a2a_service_contracts(consumer_agent_id, status);
CREATE INDEX idx_contracts_status ON a2a_service_contracts(status) WHERE status IN ('proposed', 'negotiating', 'active');
CREATE INDEX idx_contracts_capabilities ON a2a_service_contracts USING GIN (capabilities);
CREATE INDEX idx_contracts_expires ON a2a_service_contracts(expires_at) WHERE status = 'active';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_contract_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contract_updated_at
  BEFORE UPDATE ON a2a_service_contracts
  FOR EACH ROW EXECUTE FUNCTION update_contract_timestamp();

-- ──────────────────────────────────────────────
-- Negotiation History
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_contract_negotiations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     UUID NOT NULL REFERENCES a2a_service_contracts(id) ON DELETE CASCADE,
  agent_id        UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN ('propose', 'counter', 'accept', 'reject')),
  proposed_sla    JSONB,
  proposed_pricing JSONB,
  proposed_duration_days INTEGER,
  rationale       TEXT,
  round           INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_negotiations_contract ON a2a_contract_negotiations(contract_id, round);

-- ──────────────────────────────────────────────
-- SLA Violations
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_sla_violations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     UUID NOT NULL REFERENCES a2a_service_contracts(id) ON DELETE CASCADE,
  metric          TEXT NOT NULL CHECK (metric IN ('latency', 'quality', 'failure_rate', 'throughput')),
  threshold_value DOUBLE PRECISION NOT NULL,
  actual_value    DOUBLE PRECISION NOT NULL,
  task_id         UUID,
  severity        TEXT NOT NULL DEFAULT 'warning'
                    CHECK (severity IN ('warning', 'critical', 'breach')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_violations_contract ON a2a_sla_violations(contract_id, severity);
CREATE INDEX idx_violations_severity ON a2a_sla_violations(severity) WHERE severity IN ('critical', 'breach');

-- ──────────────────────────────────────────────
-- RLS: Service role access only (matches other A2A tables)
-- ──────────────────────────────────────────────

ALTER TABLE a2a_service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_contract_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_sla_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_contracts ON a2a_service_contracts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY service_role_negotiations ON a2a_contract_negotiations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY service_role_violations ON a2a_sla_violations
  FOR ALL USING (auth.role() = 'service_role');

-- ──────────────────────────────────────────────
-- Auto-expire active contracts past their expiry
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION expire_contracts()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE a2a_service_contracts
  SET status = 'completed',
      termination_reason = 'Contract expired naturally'
  WHERE status = 'active'
    AND expires_at < now();
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
