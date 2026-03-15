-- A2A Knowledge Graph: Collaborative Consensus Layer
--
-- Adds endorsements, community confidence materialization, and
-- formal conflict resolution with quorum-based voting.

-- ────────────────────────────────────────────────
-- Endorsements
-- ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_knowledge_endorsements (
  entry_id   UUID NOT NULL REFERENCES a2a_knowledge_nodes(id) ON DELETE CASCADE,
  agent_id   UUID NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  rationale  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_endorsements_entry ON a2a_knowledge_endorsements(entry_id);
CREATE INDEX IF NOT EXISTS idx_endorsements_agent ON a2a_knowledge_endorsements(agent_id);

-- ────────────────────────────────────────────────
-- Community Confidence (materialized aggregate)
-- ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_knowledge_community_confidence (
  entry_id          UUID PRIMARY KEY REFERENCES a2a_knowledge_nodes(id) ON DELETE CASCADE,
  endorsement_count INTEGER NOT NULL DEFAULT 0,
  avg_confidence    DOUBLE PRECISION NOT NULL DEFAULT 0,
  confidence_stddev DOUBLE PRECISION NOT NULL DEFAULT 0,
  bayesian_score    DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  consensus_level   TEXT NOT NULL DEFAULT 'weak'
    CHECK (consensus_level IN ('strong', 'moderate', 'weak', 'contested')),
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_bayesian ON a2a_knowledge_community_confidence(bayesian_score DESC);
CREATE INDEX IF NOT EXISTS idx_cc_consensus ON a2a_knowledge_community_confidence(consensus_level);

-- ────────────────────────────────────────────────
-- Conflicts
-- ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_knowledge_conflicts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_a_id      UUID NOT NULL REFERENCES a2a_knowledge_nodes(id) ON DELETE CASCADE,
  entry_b_id      UUID NOT NULL REFERENCES a2a_knowledge_nodes(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'escalated', 'expired')),
  quorum          INTEGER NOT NULL DEFAULT 3 CHECK (quorum >= 2),
  resolution      TEXT CHECK (resolution IN ('entry_a_wins', 'entry_b_wins', 'both_valid', 'both_retracted', 'merged')),
  merged_entry_id UUID REFERENCES a2a_knowledge_nodes(id) ON DELETE SET NULL,
  raised_by       UUID NOT NULL,
  resolved_at     TIMESTAMPTZ,
  ttl_seconds     INTEGER NOT NULL DEFAULT 604800,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (entry_a_id <> entry_b_id)
);

CREATE INDEX IF NOT EXISTS idx_conflicts_status ON a2a_knowledge_conflicts(status);
CREATE INDEX IF NOT EXISTS idx_conflicts_entries ON a2a_knowledge_conflicts(entry_a_id, entry_b_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_expires ON a2a_knowledge_conflicts(expires_at) WHERE status = 'open';

-- ────────────────────────────────────────────────
-- Conflict Votes
-- ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_knowledge_conflict_votes (
  conflict_id UUID NOT NULL REFERENCES a2a_knowledge_conflicts(id) ON DELETE CASCADE,
  agent_id    UUID NOT NULL,
  vote        TEXT NOT NULL
    CHECK (vote IN ('entry_a_wins', 'entry_b_wins', 'both_valid', 'both_retracted', 'merged')),
  rationale   TEXT NOT NULL,
  confidence  DOUBLE PRECISION NOT NULL DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conflict_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_conflict_votes_conflict ON a2a_knowledge_conflict_votes(conflict_id);
