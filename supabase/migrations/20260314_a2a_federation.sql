-- A2A Federation Protocol — Database Schema
-- Enables cross-platform agent collaboration between A2A-compliant platforms.

-- ─────────────────────────────────────────────────
-- Federation Peer Registry
-- ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS federation_peers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  endpoint      TEXT NOT NULL,
  public_key    TEXT NOT NULL,
  fingerprint   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),
  inbound_trust_policy TEXT NOT NULL DEFAULT 'downgrade'
                  CHECK (inbound_trust_policy IN ('inherit', 'downgrade', 'verify_each')),
  max_inbound_trust TEXT NOT NULL DEFAULT 'verified'
                  CHECK (max_inbound_trust IN ('untrusted', 'verified')),
  outbound_routing_enabled BOOLEAN NOT NULL DEFAULT true,
  inbound_routing_enabled  BOOLEAN NOT NULL DEFAULT true,
  last_sync_at  TIMESTAMPTZ,
  sync_failure_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_federation_peers_status ON federation_peers(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_federation_peers_endpoint_active
  ON federation_peers(endpoint) WHERE status != 'revoked';
CREATE INDEX IF NOT EXISTS idx_federation_peers_fingerprint ON federation_peers(fingerprint);

-- ─────────────────────────────────────────────────
-- Cached Remote Agents from Federated Peers
-- ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS federated_agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_id         UUID NOT NULL REFERENCES federation_peers(id) ON DELETE CASCADE,
  remote_agent_id TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  capabilities    JSONB NOT NULL DEFAULT '[]'::jsonb,
  effective_trust TEXT NOT NULL DEFAULT 'untrusted'
                    CHECK (effective_trust IN ('untrusted', 'verified')),
  available       BOOLEAN NOT NULL DEFAULT true,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_federated_agents_peer ON federated_agents(peer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_federated_agents_peer_remote
  ON federated_agents(peer_id, remote_agent_id);
CREATE INDEX IF NOT EXISTS idx_federated_agents_available ON federated_agents(available);
CREATE INDEX IF NOT EXISTS idx_federated_agents_capabilities ON federated_agents
  USING GIN (capabilities jsonb_path_ops);

-- ─────────────────────────────────────────────────
-- Federated Tasks (cross-platform task tracking)
-- ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS federated_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_task_id   UUID NOT NULL,
  peer_id         UUID NOT NULL REFERENCES federation_peers(id),
  remote_agent_id TEXT NOT NULL,
  remote_task_id  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'submitted', 'accepted',
                                      'in_progress', 'completed', 'failed', 'timeout')),
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  result          JSONB,
  error           TEXT,
  trace_context   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_federated_tasks_peer ON federated_tasks(peer_id);
CREATE INDEX IF NOT EXISTS idx_federated_tasks_local ON federated_tasks(local_task_id);
CREATE INDEX IF NOT EXISTS idx_federated_tasks_status ON federated_tasks(status);
CREATE INDEX IF NOT EXISTS idx_federated_tasks_remote ON federated_tasks(remote_task_id);

-- ─────────────────────────────────────────────────
-- Federation Audit Log
-- ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS federation_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_id     UUID NOT NULL REFERENCES federation_peers(id),
  action      TEXT NOT NULL,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_federation_audit_peer ON federation_audit_log(peer_id);
CREATE INDEX IF NOT EXISTS idx_federation_audit_action ON federation_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_federation_audit_time ON federation_audit_log(created_at DESC);

-- ─────────────────────────────────────────────────
-- Add federation_peer_id to a2a_tasks for inbound tracking
-- ─────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a2a_tasks' AND column_name = 'federation_peer_id'
  ) THEN
    ALTER TABLE a2a_tasks ADD COLUMN federation_peer_id UUID REFERENCES federation_peers(id);
    CREATE INDEX idx_a2a_tasks_federation_peer ON a2a_tasks(federation_peer_id)
      WHERE federation_peer_id IS NOT NULL;
  END IF;
END $$;
