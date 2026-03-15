-- Agent Negotiation & Strategic Bargaining Protocol
-- Multi-party, multi-issue negotiation with game-theoretic strategies

-- ──────────────────────────────────────────────
-- Negotiation Sessions
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_negotiation_sessions (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL CHECK (domain IN (
    'resource_pricing', 'sla_terms', 'task_allocation', 'capability_trade',
    'coalition_formation', 'data_exchange', 'service_contract',
    'dispute_settlement', 'custom'
  )),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN (
    'initiated', 'proposing', 'bargaining', 'converging',
    'agreed', 'failed', 'mediated', 'expired', 'cancelled'
  )),
  issues JSONB NOT NULL DEFAULT '[]',
  current_round INTEGER NOT NULL DEFAULT 0,
  max_rounds INTEGER NOT NULL DEFAULT 20,
  min_rounds INTEGER NOT NULL DEFAULT 1,
  deadline JSONB,
  mediation JSONB,
  zopa_exists BOOLEAN,
  zopa_analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_neg_sessions_domain ON a2a_negotiation_sessions(domain);
CREATE INDEX idx_neg_sessions_status ON a2a_negotiation_sessions(status);
CREATE INDEX idx_neg_sessions_created ON a2a_negotiation_sessions(created_at DESC);

-- ──────────────────────────────────────────────
-- Negotiation Parties
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_negotiation_parties (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  negotiation_id TEXT NOT NULL REFERENCES a2a_negotiation_sessions(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('initiator', 'responder', 'mediator', 'observer')),
  strategy TEXT NOT NULL,
  strategy_params JSONB,
  preferences JSONB NOT NULL DEFAULT '[]',
  batna JSONB,
  has_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  offers_made INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(negotiation_id, agent_id)
);

CREATE INDEX idx_neg_parties_negotiation ON a2a_negotiation_parties(negotiation_id);
CREATE INDEX idx_neg_parties_agent ON a2a_negotiation_parties(agent_id);

-- ──────────────────────────────────────────────
-- Offers
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_negotiation_offers (
  id TEXT PRIMARY KEY,
  negotiation_id TEXT NOT NULL REFERENCES a2a_negotiation_sessions(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  from_agent_id TEXT NOT NULL,
  proposed_values JSONB NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'rejected', 'countered', 'expired', 'withdrawn'
  )),
  concession_magnitude DOUBLE PRECISION,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_neg_offers_negotiation ON a2a_negotiation_offers(negotiation_id);
CREATE INDEX idx_neg_offers_round ON a2a_negotiation_offers(negotiation_id, round);
CREATE INDEX idx_neg_offers_agent ON a2a_negotiation_offers(from_agent_id);

-- ──────────────────────────────────────────────
-- Agreements
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_negotiation_agreements (
  id TEXT PRIMARY KEY,
  negotiation_id TEXT NOT NULL REFERENCES a2a_negotiation_sessions(id) ON DELETE CASCADE,
  agreed_values JSONB NOT NULL,
  signatories JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'signed', 'enforcing', 'completed', 'breached', 'voided'
  )),
  enforcement_actions JSONB,
  breach_penalties JSONB,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_neg_agreements_negotiation ON a2a_negotiation_agreements(negotiation_id);
CREATE INDEX idx_neg_agreements_status ON a2a_negotiation_agreements(status);

-- ──────────────────────────────────────────────
-- Audit Trail
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_negotiation_audit (
  id TEXT PRIMARY KEY,
  negotiation_id TEXT NOT NULL REFERENCES a2a_negotiation_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  agent_id TEXT,
  round INTEGER,
  details JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_neg_audit_negotiation ON a2a_negotiation_audit(negotiation_id);
CREATE INDEX idx_neg_audit_event ON a2a_negotiation_audit(event_type);
CREATE INDEX idx_neg_audit_time ON a2a_negotiation_audit(timestamp DESC);
