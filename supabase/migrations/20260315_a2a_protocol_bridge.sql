-- ============================================================
-- A2A Universal Protocol Bridge — Schema
-- Enables cross-platform agent interoperability by translating
-- between protocol families (Google A2A, OpenAI, LangChain, etc.)
-- ============================================================

-- Protocol adapters registered in the system
CREATE TABLE IF NOT EXISTS a2a_protocol_adapters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol      TEXT NOT NULL CHECK (protocol IN (
    'rareagent', 'google_a2a', 'openai_agents', 'langchain',
    'autogen', 'oasf', 'mcp', 'custom'
  )),
  version       TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  description   TEXT NOT NULL,
  supported_wire_formats  TEXT[] NOT NULL DEFAULT '{}',
  supported_auth_methods  TEXT[] NOT NULL DEFAULT '{}',
  detection_patterns      JSONB NOT NULL DEFAULT '[]',
  capability_map          JSONB NOT NULL DEFAULT '[]',
  state_map               JSONB NOT NULL DEFAULT '[]',
  bidirectional           BOOLEAN NOT NULL DEFAULT false,
  supports_streaming      BOOLEAN NOT NULL DEFAULT false,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'deprecated', 'experimental', 'disabled'
  )),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_protocol_adapters_protocol ON a2a_protocol_adapters(protocol);
CREATE INDEX idx_protocol_adapters_status ON a2a_protocol_adapters(status);

-- Protocol negotiations between agent pairs
CREATE TABLE IF NOT EXISTS a2a_protocol_negotiations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_agent_id    TEXT NOT NULL,
  responder_agent_id    TEXT NOT NULL,
  initiator_protocols   JSONB NOT NULL DEFAULT '[]',
  responder_protocols   JSONB NOT NULL DEFAULT '[]',
  agreed_protocol       JSONB,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'agreed', 'failed', 'expired'
  )),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at           TIMESTAMPTZ
);

CREATE INDEX idx_protocol_negotiations_initiator ON a2a_protocol_negotiations(initiator_agent_id);
CREATE INDEX idx_protocol_negotiations_responder ON a2a_protocol_negotiations(responder_agent_id);
CREATE INDEX idx_protocol_negotiations_status ON a2a_protocol_negotiations(status);

-- Translation sessions for multi-turn cross-protocol conversations
CREATE TABLE IF NOT EXISTS a2a_translation_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_a_id        TEXT NOT NULL,
  agent_a_protocol  TEXT NOT NULL,
  agent_a_adapter   UUID REFERENCES a2a_protocol_adapters(id),
  agent_b_id        TEXT NOT NULL,
  agent_b_protocol  TEXT NOT NULL,
  agent_b_adapter   UUID REFERENCES a2a_protocol_adapters(id),
  agreed_protocol   JSONB NOT NULL,
  message_count     INTEGER NOT NULL DEFAULT 0,
  stats             JSONB NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'paused', 'expired', 'closed'
  )),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_translation_sessions_agent_a ON a2a_translation_sessions(agent_a_id);
CREATE INDEX idx_translation_sessions_agent_b ON a2a_translation_sessions(agent_b_id);
CREATE INDEX idx_translation_sessions_status ON a2a_translation_sessions(status);
CREATE INDEX idx_translation_sessions_expires ON a2a_translation_sessions(expires_at);

-- Individual translated messages within sessions (audit trail)
CREATE TABLE IF NOT EXISTS a2a_translated_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES a2a_translation_sessions(id) ON DELETE CASCADE,
  source_protocol   TEXT NOT NULL,
  target_protocol   TEXT NOT NULL,
  adapter_id        UUID REFERENCES a2a_protocol_adapters(id),
  message_type      TEXT NOT NULL,
  sender_agent_id   TEXT NOT NULL,
  canonical_payload JSONB NOT NULL,
  raw_original      TEXT,
  translated_output TEXT,
  duration_ms       INTEGER NOT NULL DEFAULT 0,
  lossy             BOOLEAN NOT NULL DEFAULT false,
  unmapped_fields   TEXT[] NOT NULL DEFAULT '{}',
  warnings          TEXT[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_translated_messages_session ON a2a_translated_messages(session_id);
CREATE INDEX idx_translated_messages_sender ON a2a_translated_messages(sender_agent_id);
CREATE INDEX idx_translated_messages_created ON a2a_translated_messages(created_at);

-- Auto-expire old sessions
CREATE INDEX idx_translation_sessions_cleanup
  ON a2a_translation_sessions(status, expires_at)
  WHERE status = 'active';
