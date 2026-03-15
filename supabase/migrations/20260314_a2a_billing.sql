-- A2A Token Economy & Billing Ledger
--
-- Agent wallets, ledger transactions, and settlement infrastructure
-- for the agent-to-agent economic system.

-- ──────────────────────────────────────────────
-- Agent Wallets
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  currency VARCHAR(16) NOT NULL DEFAULT 'credits',
  balance NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  held_balance NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (held_balance >= 0),
  lifetime_credits NUMERIC(18, 4) NOT NULL DEFAULT 0,
  lifetime_debits NUMERIC(18, 4) NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, currency)
);

CREATE INDEX idx_a2a_wallets_agent ON a2a_wallets(agent_id);
CREATE INDEX idx_a2a_wallets_status ON a2a_wallets(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_a2a_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_a2a_wallets_updated_at
  BEFORE UPDATE ON a2a_wallets
  FOR EACH ROW EXECUTE FUNCTION update_a2a_wallet_updated_at();

-- ──────────────────────────────────────────────
-- Ledger Transactions (immutable log)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES a2a_wallets(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  type VARCHAR(16) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'charge', 'earning', 'hold', 'hold_release', 'refund')),
  amount NUMERIC(18, 4) NOT NULL,
  currency VARCHAR(16) NOT NULL DEFAULT 'credits',
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'failed', 'reversed')),
  contract_id UUID REFERENCES a2a_service_contracts(id) ON DELETE SET NULL,
  task_id UUID REFERENCES a2a_tasks(id) ON DELETE SET NULL,
  counterparty_agent_id UUID REFERENCES agent_registry(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  reference_tx_id UUID REFERENCES a2a_ledger_transactions(id) ON DELETE SET NULL,
  idempotency_key VARCHAR(128),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);

-- Core query indices
CREATE INDEX idx_a2a_tx_wallet ON a2a_ledger_transactions(wallet_id);
CREATE INDEX idx_a2a_tx_agent ON a2a_ledger_transactions(agent_id);
CREATE INDEX idx_a2a_tx_type ON a2a_ledger_transactions(type);
CREATE INDEX idx_a2a_tx_status ON a2a_ledger_transactions(status);
CREATE INDEX idx_a2a_tx_contract ON a2a_ledger_transactions(contract_id);
CREATE INDEX idx_a2a_tx_task ON a2a_ledger_transactions(task_id);
CREATE INDEX idx_a2a_tx_settled_at ON a2a_ledger_transactions(settled_at);
CREATE INDEX idx_a2a_tx_idempotency ON a2a_ledger_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Composite index for daily spend queries (governance integration)
CREATE INDEX idx_a2a_tx_daily_spend ON a2a_ledger_transactions(agent_id, type, status, currency, settled_at)
  WHERE type = 'charge' AND status = 'settled';

-- ──────────────────────────────────────────────
-- RLS Policies
-- ──────────────────────────────────────────────

ALTER TABLE a2a_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_ledger_transactions ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by API routes via service-role key)
CREATE POLICY a2a_wallets_service_all ON a2a_wallets
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY a2a_ledger_tx_service_all ON a2a_ledger_transactions
  FOR ALL USING (true) WITH CHECK (true);
