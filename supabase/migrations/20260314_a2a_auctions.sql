-- A2A Task Auction & Bidding System
--
-- Creates the marketplace tables for competitive task allocation.
-- Auctions allow requesters to post tasks for bidding, provider agents
-- compete on price/speed/quality, and escrow protects both parties.

-- ──────────────────────────────────────────────
-- Auctions
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_auctions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_agent_id UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,

  -- Task definition
  required_capability TEXT NOT NULL,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,
  task_input         JSONB NOT NULL DEFAULT '{}',

  -- Auction mechanics
  auction_type       TEXT NOT NULL CHECK (auction_type IN ('open', 'sealed', 'reverse', 'dutch')),
  status             TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'evaluating', 'awarded', 'settled', 'cancelled', 'expired')),
  max_price          NUMERIC(12,2) NOT NULL CHECK (max_price > 0),
  currency           TEXT NOT NULL DEFAULT 'credits',

  -- Dutch auction specifics
  dutch_start_price          NUMERIC(12,2),
  dutch_decrement_per_minute NUMERIC(12,4),

  -- Qualification requirements
  min_trust_level     TEXT NOT NULL DEFAULT 'untrusted'
                      CHECK (min_trust_level IN ('untrusted', 'verified', 'partner')),
  min_reputation_score NUMERIC(5,4) NOT NULL DEFAULT 0,

  -- Deadlines
  bidding_deadline    TIMESTAMPTZ NOT NULL,
  completion_deadline TIMESTAMPTZ NOT NULL,

  -- Escrow
  escrow_tx_id       UUID,

  -- Outcome
  winning_bid_id     UUID,
  task_id            UUID,
  bid_count          INT NOT NULL DEFAULT 0,

  -- Evaluation criteria
  evaluation_weights JSONB NOT NULL DEFAULT '{"price": 0.4, "reputation": 0.35, "speed": 0.25}',

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT auction_deadlines CHECK (completion_deadline > bidding_deadline)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_a2a_auctions_status ON a2a_auctions (status);
CREATE INDEX IF NOT EXISTS idx_a2a_auctions_capability ON a2a_auctions (required_capability);
CREATE INDEX IF NOT EXISTS idx_a2a_auctions_requester ON a2a_auctions (requester_agent_id);
CREATE INDEX IF NOT EXISTS idx_a2a_auctions_deadline ON a2a_auctions (bidding_deadline) WHERE status = 'open';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_a2a_auctions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_a2a_auctions_updated ON a2a_auctions;
CREATE TRIGGER trg_a2a_auctions_updated
  BEFORE UPDATE ON a2a_auctions
  FOR EACH ROW EXECUTE FUNCTION update_a2a_auctions_updated_at();

-- ──────────────────────────────────────────────
-- Bids
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_auction_bids (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id         UUID NOT NULL REFERENCES a2a_auctions(id) ON DELETE CASCADE,
  bidder_agent_id    UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,

  -- Bid terms
  price              NUMERIC(12,2) NOT NULL CHECK (price > 0),
  estimated_minutes  INT NOT NULL CHECK (estimated_minutes > 0),
  status             TEXT NOT NULL DEFAULT 'submitted'
                     CHECK (status IN ('submitted', 'won', 'lost', 'withdrawn')),
  pitch              TEXT NOT NULL,
  matched_capability_id TEXT NOT NULL,

  -- Snapshots at bid time (for evaluation fairness)
  reputation_score_snapshot NUMERIC(5,4) NOT NULL DEFAULT 0,
  trust_level_snapshot      TEXT NOT NULL DEFAULT 'untrusted',

  -- Evaluation results (filled during award)
  evaluation_score   NUMERIC(8,4),
  score_breakdown    JSONB,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One active bid per agent per auction
  CONSTRAINT unique_active_bid UNIQUE (auction_id, bidder_agent_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_a2a_bids_auction ON a2a_auction_bids (auction_id);
CREATE INDEX IF NOT EXISTS idx_a2a_bids_bidder ON a2a_auction_bids (bidder_agent_id);
CREATE INDEX IF NOT EXISTS idx_a2a_bids_status ON a2a_auction_bids (auction_id, status);

-- ──────────────────────────────────────────────
-- Enable RLS (service role bypasses)
-- ──────────────────────────────────────────────

ALTER TABLE a2a_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_auction_bids ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_a2a_auctions" ON a2a_auctions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_a2a_auction_bids" ON a2a_auction_bids
  FOR ALL TO service_role USING (true) WITH CHECK (true);
