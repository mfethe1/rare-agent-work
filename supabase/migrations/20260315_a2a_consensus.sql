-- Migration: Agent Consensus & Distributed Decision Protocol
-- Date: 2026-03-15
-- Description: Tables for multi-agent collective decision-making via
--   consensus councils, proposals, votes, delegations, conviction voting,
--   split-brain resolution, and audit logging.

-- ──────────────────────────────────────────────
-- 1. a2a_consensus_councils
-- ──────────────────────────────────────────────

CREATE TABLE a2a_consensus_councils (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  domains         JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_algorithm TEXT NOT NULL DEFAULT 'weighted_majority'
    CHECK (default_algorithm IN (
      'weighted_majority', 'supermajority', 'conviction_voting',
      'liquid_democracy', 'optimistic_approval', 'unanimous'
    )),
  default_quorum  NUMERIC NOT NULL DEFAULT 0.5
    CHECK (default_quorum > 0 AND default_quorum <= 1),
  default_approval_threshold NUMERIC NOT NULL DEFAULT 0.5
    CHECK (default_approval_threshold > 0 AND default_approval_threshold <= 1),
  domain_overrides JSONB NOT NULL DEFAULT '[]'::jsonb,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_a2a_consensus_councils_active ON a2a_consensus_councils (active) WHERE active = true;

-- ──────────────────────────────────────────────
-- 2. a2a_council_members
-- ──────────────────────────────────────────────

CREATE TABLE a2a_council_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id       UUID NOT NULL REFERENCES a2a_consensus_councils(id) ON DELETE CASCADE,
  agent_id         TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('chair', 'member', 'observer', 'veto_holder')),
  weight_multiplier NUMERIC NOT NULL DEFAULT 1.0
    CHECK (weight_multiplier > 0),
  voting_domains   JSONB NOT NULL DEFAULT '[]'::jsonb,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (council_id, agent_id)
);

CREATE INDEX idx_a2a_council_members_council_id ON a2a_council_members (council_id);
CREATE INDEX idx_a2a_council_members_agent_id ON a2a_council_members (agent_id);

-- ──────────────────────────────────────────────
-- 3. a2a_consensus_proposals
-- ──────────────────────────────────────────────

CREATE TABLE a2a_consensus_proposals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id        TEXT NOT NULL,
  council_id         UUID NOT NULL REFERENCES a2a_consensus_councils(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  domain             TEXT NOT NULL
    CHECK (domain IN (
      'resource_allocation', 'policy_change', 'membership_admission',
      'membership_removal', 'capability_deployment', 'emergency_response',
      'strategic_planning', 'conflict_resolution', 'budget_approval',
      'safety_override', 'protocol_upgrade', 'custom'
    )),
  status             TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'open', 'voting', 'decided_approved', 'decided_rejected',
      'executed', 'expired', 'vetoed', 'cancelled'
    )),
  algorithm          TEXT NOT NULL DEFAULT 'weighted_majority'
    CHECK (algorithm IN (
      'weighted_majority', 'supermajority', 'conviction_voting',
      'liquid_democracy', 'optimistic_approval', 'unanimous'
    )),
  payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
  voting_opens_at    TIMESTAMPTZ,
  voting_closes_at   TIMESTAMPTZ,
  quorum_threshold   NUMERIC NOT NULL DEFAULT 0.5
    CHECK (quorum_threshold > 0 AND quorum_threshold <= 1),
  approval_threshold NUMERIC NOT NULL DEFAULT 0.5
    CHECK (approval_threshold > 0 AND approval_threshold <= 1),
  veto_enabled       BOOLEAN NOT NULL DEFAULT false,
  veto_holders       JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome            JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (voting_closes_at IS NULL OR voting_opens_at IS NULL OR voting_closes_at > voting_opens_at)
);

CREATE INDEX idx_a2a_consensus_proposals_council_id ON a2a_consensus_proposals (council_id);
CREATE INDEX idx_a2a_consensus_proposals_proposer_id ON a2a_consensus_proposals (proposer_id);
CREATE INDEX idx_a2a_consensus_proposals_status ON a2a_consensus_proposals (status);
CREATE INDEX idx_a2a_consensus_proposals_domain ON a2a_consensus_proposals (domain);
CREATE INDEX idx_a2a_consensus_proposals_voting_closes ON a2a_consensus_proposals (voting_closes_at)
  WHERE status IN ('open', 'voting');

-- ──────────────────────────────────────────────
-- 4. a2a_consensus_votes
-- ──────────────────────────────────────────────

CREATE TABLE a2a_consensus_votes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id      UUID NOT NULL REFERENCES a2a_consensus_proposals(id) ON DELETE CASCADE,
  voter_id         TEXT NOT NULL,
  choice           TEXT NOT NULL
    CHECK (choice IN ('approve', 'reject', 'abstain', 'veto')),
  weight           NUMERIC NOT NULL DEFAULT 1.0
    CHECK (weight >= 0),
  conviction_start TIMESTAMPTZ,
  rationale        TEXT,
  delegated_from   TEXT,
  delegation_chain JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, voter_id)
);

CREATE INDEX idx_a2a_consensus_votes_proposal_id ON a2a_consensus_votes (proposal_id);
CREATE INDEX idx_a2a_consensus_votes_voter_id ON a2a_consensus_votes (voter_id);
CREATE INDEX idx_a2a_consensus_votes_choice ON a2a_consensus_votes (proposal_id, choice);

-- ──────────────────────────────────────────────
-- 5. a2a_vote_delegations
-- ──────────────────────────────────────────────

CREATE TABLE a2a_vote_delegations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_id  TEXT NOT NULL,
  delegate_id   TEXT NOT NULL,
  domains       JSONB NOT NULL DEFAULT '[]'::jsonb,
  council_id    UUID REFERENCES a2a_consensus_councils(id) ON DELETE SET NULL,
  transitive    BOOLEAN NOT NULL DEFAULT false,
  max_depth     INTEGER NOT NULL DEFAULT 1
    CHECK (max_depth >= 1 AND max_depth <= 10),
  active_from   TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_until  TIMESTAMPTZ,
  revoked       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (delegator_id <> delegate_id),
  CHECK (active_until IS NULL OR active_until > active_from)
);

CREATE INDEX idx_a2a_vote_delegations_delegator ON a2a_vote_delegations (delegator_id);
CREATE INDEX idx_a2a_vote_delegations_delegate ON a2a_vote_delegations (delegate_id);
CREATE INDEX idx_a2a_vote_delegations_council ON a2a_vote_delegations (council_id);
CREATE INDEX idx_a2a_vote_delegations_active ON a2a_vote_delegations (delegator_id, revoked)
  WHERE revoked = false;

-- ──────────────────────────────────────────────
-- 6. a2a_conviction_states
-- ──────────────────────────────────────────────

CREATE TABLE a2a_conviction_states (
  proposal_id           UUID NOT NULL REFERENCES a2a_consensus_proposals(id) ON DELETE CASCADE,
  voter_id              TEXT NOT NULL,
  base_weight           NUMERIC NOT NULL DEFAULT 1.0
    CHECK (base_weight >= 0),
  accumulated_conviction NUMERIC NOT NULL DEFAULT 0
    CHECK (accumulated_conviction >= 0),
  half_life_seconds     INTEGER NOT NULL DEFAULT 86400
    CHECK (half_life_seconds > 0),
  conviction_start      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_computed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, voter_id)
);

-- ──────────────────────────────────────────────
-- 7. a2a_split_brain_events
-- ──────────────────────────────────────────────

CREATE TABLE a2a_split_brain_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id   UUID NOT NULL REFERENCES a2a_consensus_councils(id) ON DELETE CASCADE,
  proposal_id  UUID NOT NULL REFERENCES a2a_consensus_proposals(id) ON DELETE CASCADE,
  partitions   JSONB NOT NULL DEFAULT '[]'::jsonb,
  strategy     TEXT NOT NULL
    CHECK (strategy IN (
      'highest_quorum_wins', 'chair_partition_wins', 'latest_timestamp_wins',
      'merge_and_revote', 'manual_resolution'
    )),
  resolution   JSONB,
  detected_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_a2a_split_brain_events_council ON a2a_split_brain_events (council_id);
CREATE INDEX idx_a2a_split_brain_events_proposal ON a2a_split_brain_events (proposal_id);

-- ──────────────────────────────────────────────
-- 8. a2a_consensus_audit_log
-- ──────────────────────────────────────────────

CREATE TABLE a2a_consensus_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT NOT NULL
    CHECK (event_type IN (
      'proposal_created', 'proposal_opened', 'vote_cast', 'vote_delegated',
      'delegation_created', 'delegation_revoked', 'veto_exercised',
      'quorum_reached', 'proposal_decided', 'proposal_executed',
      'proposal_expired', 'proposal_cancelled', 'split_brain_detected',
      'split_brain_resolved', 'council_created', 'council_member_added',
      'council_member_removed', 'conviction_updated'
    )),
  council_id   UUID REFERENCES a2a_consensus_councils(id) ON DELETE SET NULL,
  proposal_id  UUID REFERENCES a2a_consensus_proposals(id) ON DELETE SET NULL,
  actor_id     TEXT NOT NULL,
  details      JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_a2a_consensus_audit_log_council ON a2a_consensus_audit_log (council_id);
CREATE INDEX idx_a2a_consensus_audit_log_proposal ON a2a_consensus_audit_log (proposal_id);
CREATE INDEX idx_a2a_consensus_audit_log_event_type ON a2a_consensus_audit_log (event_type);
CREATE INDEX idx_a2a_consensus_audit_log_actor ON a2a_consensus_audit_log (actor_id);
CREATE INDEX idx_a2a_consensus_audit_log_timestamp ON a2a_consensus_audit_log (timestamp DESC);

-- ──────────────────────────────────────────────
-- RLS Policies — service_role access
-- ──────────────────────────────────────────────

ALTER TABLE a2a_consensus_councils    ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_council_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_consensus_proposals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_consensus_votes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_vote_delegations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_conviction_states     ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_split_brain_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_consensus_audit_log   ENABLE ROW LEVEL SECURITY;

-- Service role gets full access to all consensus tables
CREATE POLICY "service_role_all_consensus_councils"    ON a2a_consensus_councils    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_council_members"       ON a2a_council_members       FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_consensus_proposals"   ON a2a_consensus_proposals   FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_consensus_votes"       ON a2a_consensus_votes       FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_vote_delegations"      ON a2a_vote_delegations      FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_conviction_states"     ON a2a_conviction_states     FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_split_brain_events"    ON a2a_split_brain_events    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_consensus_audit_log"   ON a2a_consensus_audit_log   FOR ALL USING (auth.role() = 'service_role');

-- ──────────────────────────────────────────────
-- Updated-at trigger
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION a2a_consensus_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_a2a_consensus_councils_updated
  BEFORE UPDATE ON a2a_consensus_councils
  FOR EACH ROW EXECUTE FUNCTION a2a_consensus_set_updated_at();

CREATE TRIGGER trg_a2a_consensus_proposals_updated
  BEFORE UPDATE ON a2a_consensus_proposals
  FOR EACH ROW EXECUTE FUNCTION a2a_consensus_set_updated_at();
