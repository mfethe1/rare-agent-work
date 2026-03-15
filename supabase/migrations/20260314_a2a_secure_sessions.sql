-- A2A Secure Sessions: End-to-end encrypted agent communication channels
--
-- Provides forward-secret encrypted sessions between agents using
-- ECDH P-256 key agreement + HKDF-SHA-256 + AES-256-GCM.
-- The platform stores only ciphertext and session metadata.

-- ──────────────────────────────────────────────
-- Secure Sessions Table
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_secure_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_agent_id UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  responder_agent_id UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'terminated', 'expired')),

  -- ECDH handshake material (ephemeral P-256 public keys, base64url)
  initiator_ephemeral_public_key TEXT NOT NULL,
  responder_ephemeral_public_key TEXT,

  -- Ed25519 signatures proving identity of ephemeral key owners
  initiator_key_signature TEXT NOT NULL,
  responder_key_signature TEXT,

  -- Ed25519 identity key IDs used for signing
  initiator_identity_key_id UUID NOT NULL,
  responder_identity_key_id UUID,

  -- Key derivation salt (shared, 32 bytes base64url)
  hkdf_salt       TEXT NOT NULL,

  -- Replay protection: next expected sequence per sender
  initiator_sequence INTEGER NOT NULL DEFAULT 0,
  responder_sequence INTEGER NOT NULL DEFAULT 0,
  message_count   INTEGER NOT NULL DEFAULT 0,

  -- Lifecycle
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  terminated_at   TIMESTAMPTZ,
  terminated_by   UUID REFERENCES agent_registry(id),
  purpose         TEXT,

  -- Constraints
  CONSTRAINT different_agents CHECK (initiator_agent_id != responder_agent_id),
  CONSTRAINT non_negative_sequences CHECK (
    initiator_sequence >= 0 AND responder_sequence >= 0 AND message_count >= 0
  )
);

-- Performance indexes
CREATE INDEX idx_a2a_sessions_initiator ON a2a_secure_sessions(initiator_agent_id, status);
CREATE INDEX idx_a2a_sessions_responder ON a2a_secure_sessions(responder_agent_id, status);
CREATE INDEX idx_a2a_sessions_active ON a2a_secure_sessions(status, expires_at)
  WHERE status IN ('pending', 'active');
CREATE INDEX idx_a2a_sessions_last_active ON a2a_secure_sessions(last_active_at DESC);

-- ──────────────────────────────────────────────
-- Encrypted Session Messages Table
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_session_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES a2a_secure_sessions(id) ON DELETE CASCADE,
  sender_agent_id UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  sequence        INTEGER NOT NULL,

  -- AES-256-GCM encrypted payload (platform cannot read this)
  ciphertext      TEXT NOT NULL,
  iv              TEXT NOT NULL,     -- 96-bit IV (base64url)
  auth_tag        TEXT NOT NULL,     -- 128-bit GCM auth tag (base64url)
  aad             TEXT NOT NULL,     -- Additional authenticated data (base64url)

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique sequence per sender per session (replay protection at DB level)
  CONSTRAINT unique_session_sequence UNIQUE (session_id, sender_agent_id, sequence),
  CONSTRAINT non_negative_sequence CHECK (sequence >= 0)
);

-- Performance indexes
CREATE INDEX idx_a2a_messages_session ON a2a_session_messages(session_id, sequence);
CREATE INDEX idx_a2a_messages_sender ON a2a_session_messages(session_id, sender_agent_id, sequence);

-- ──────────────────────────────────────────────
-- Auto-expire sessions (can be called by a cron job)
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION expire_stale_sessions()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE a2a_secure_sessions
  SET status = 'expired'
  WHERE status IN ('pending', 'active')
    AND expires_at < now();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;
