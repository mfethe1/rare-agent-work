-- A2A Messaging Channels
-- Lightweight, scoped, bidirectional communication between agents.
-- Enables negotiation, consensus, and real-time collaboration.

-- ──────────────────────────────────────────────
-- Channels
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_channels (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (char_length(name) <= 200),
  description   text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  channel_type  text NOT NULL CHECK (channel_type IN ('direct', 'group', 'topic')),
  created_by    uuid NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  correlation_id text,
  is_active     boolean NOT NULL DEFAULT true,
  ttl_seconds   integer NOT NULL DEFAULT 86400 CHECK (ttl_seconds >= 3600 AND ttl_seconds <= 2592000),
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup by creator, type, and expiry
CREATE INDEX idx_a2a_channels_created_by ON a2a_channels (created_by);
CREATE INDEX idx_a2a_channels_type ON a2a_channels (channel_type);
CREATE INDEX idx_a2a_channels_correlation ON a2a_channels (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_a2a_channels_expires ON a2a_channels (expires_at);

-- ──────────────────────────────────────────────
-- Channel Members
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_channel_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    uuid NOT NULL REFERENCES a2a_channels(id) ON DELETE CASCADE,
  agent_id      uuid NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member', 'observer')),
  joined_at     timestamptz NOT NULL DEFAULT now(),
  last_read_at  timestamptz NOT NULL DEFAULT now(),
  -- Each agent can only be a member once per channel
  UNIQUE (channel_id, agent_id)
);

-- Fast lookup: which channels is an agent in?
CREATE INDEX idx_a2a_channel_members_agent ON a2a_channel_members (agent_id);
CREATE INDEX idx_a2a_channel_members_channel ON a2a_channel_members (channel_id);

-- ──────────────────────────────────────────────
-- Messages
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_channel_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id       uuid NOT NULL REFERENCES a2a_channels(id) ON DELETE CASCADE,
  sender_agent_id  uuid NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  message_type     text NOT NULL CHECK (message_type IN ('text', 'request', 'response', 'proposal', 'vote', 'notification')),
  content          jsonb NOT NULL DEFAULT '{}',
  reply_to         uuid REFERENCES a2a_channel_messages(id) ON DELETE SET NULL,
  proposal_id      uuid REFERENCES a2a_channel_messages(id) ON DELETE SET NULL,
  vote             text CHECK (vote IS NULL OR vote IN ('approve', 'reject', 'abstain')),
  metadata         jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup by channel (primary access pattern), with time-ordered pagination
CREATE INDEX idx_a2a_messages_channel_time ON a2a_channel_messages (channel_id, created_at DESC);
-- Thread queries: find all replies to a message
CREATE INDEX idx_a2a_messages_reply_to ON a2a_channel_messages (reply_to) WHERE reply_to IS NOT NULL;
-- Vote tallying: find all votes for a proposal
CREATE INDEX idx_a2a_messages_proposal ON a2a_channel_messages (proposal_id) WHERE proposal_id IS NOT NULL;
-- Filter by message type within a channel
CREATE INDEX idx_a2a_messages_type ON a2a_channel_messages (channel_id, message_type);

-- ──────────────────────────────────────────────
-- Auto-update channel expires_at on new message
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_channel_expiry()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE a2a_channels
  SET expires_at = now() + (ttl_seconds || ' seconds')::interval,
      updated_at = now()
  WHERE id = NEW.channel_id AND is_active = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_channel_expiry
  AFTER INSERT ON a2a_channel_messages
  FOR EACH ROW
  EXECUTE FUNCTION refresh_channel_expiry();

-- ──────────────────────────────────────────────
-- Prevent direct channels from having > 2 members
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_direct_channel_limit()
RETURNS TRIGGER AS $$
DECLARE
  ch_type text;
  member_count integer;
BEGIN
  SELECT channel_type INTO ch_type FROM a2a_channels WHERE id = NEW.channel_id;
  IF ch_type = 'direct' THEN
    SELECT count(*) INTO member_count FROM a2a_channel_members WHERE channel_id = NEW.channel_id;
    IF member_count >= 2 THEN
      RAISE EXCEPTION 'Direct channels cannot have more than 2 members';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_direct_channel_limit
  BEFORE INSERT ON a2a_channel_members
  FOR EACH ROW
  EXECUTE FUNCTION enforce_direct_channel_limit();

-- ──────────────────────────────────────────────
-- Prevent duplicate votes on same proposal by same agent
-- ──────────────────────────────────────────────

CREATE UNIQUE INDEX idx_a2a_messages_unique_vote
  ON a2a_channel_messages (proposal_id, sender_agent_id)
  WHERE message_type = 'vote' AND proposal_id IS NOT NULL;
