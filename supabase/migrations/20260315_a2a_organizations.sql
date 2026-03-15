-- ============================================================================
-- A2A Agent Organizations
--
-- Enables agents to form persistent organizational structures with:
-- - Hierarchical RBAC (owner > admin > operator > member > viewer)
-- - Trust inheritance from org to member agents
-- - Shared billing and governance policies
-- - Cross-organization collaboration agreements
-- - Full audit trail
-- ============================================================================

-- ── Organizations ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle      TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'active', 'suspended', 'dissolved')),
  trust_level TEXT NOT NULL DEFAULT 'verified'
                CHECK (trust_level IN ('untrusted', 'verified', 'partner')),
  callback_url TEXT,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  agent_id    UUID REFERENCES agent_registry(id),
  created_by  UUID NOT NULL REFERENCES agent_registry(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_a2a_org_handle ON a2a_organizations(handle);
CREATE INDEX IF NOT EXISTS idx_a2a_org_status ON a2a_organizations(status);
CREATE INDEX IF NOT EXISTS idx_a2a_org_agent_id ON a2a_organizations(agent_id);

-- ── Organization Members ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_org_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES a2a_organizations(id) ON DELETE CASCADE,
  agent_id            UUID NOT NULL REFERENCES agent_registry(id),
  role                TEXT NOT NULL DEFAULT 'member'
                        CHECK (role IN ('owner', 'admin', 'operator', 'member', 'viewer')),
  status              TEXT NOT NULL DEFAULT 'invited'
                        CHECK (status IN ('invited', 'active', 'suspended', 'departed')),
  daily_spend_limit   NUMERIC,
  extra_permissions   JSONB NOT NULL DEFAULT '[]'::jsonb,
  revoked_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  invited_by          UUID NOT NULL REFERENCES agent_registry(id),
  joined_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_a2a_org_member_org ON a2a_org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_a2a_org_member_agent ON a2a_org_members(agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_a2a_org_member_unique_active
  ON a2a_org_members(org_id, agent_id) WHERE status IN ('active', 'invited');

-- ── Cross-Organization Collaborations ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_org_collaborations (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_org_id                 UUID NOT NULL REFERENCES a2a_organizations(id),
  responder_org_id                UUID NOT NULL REFERENCES a2a_organizations(id),
  status                          TEXT NOT NULL DEFAULT 'proposed'
                                    CHECK (status IN ('proposed', 'active', 'suspended', 'terminated')),
  purpose                         TEXT NOT NULL DEFAULT '',
  shared_capabilities_proposer    JSONB NOT NULL DEFAULT '[]'::jsonb,
  shared_capabilities_responder   JSONB NOT NULL DEFAULT '[]'::jsonb,
  mutual_trust_level              TEXT NOT NULL DEFAULT 'verified'
                                    CHECK (mutual_trust_level IN ('untrusted', 'verified', 'partner')),
  billing_mode                    TEXT NOT NULL DEFAULT 'sender_pays'
                                    CHECK (billing_mode IN ('sender_pays', 'receiver_pays', 'split', 'free')),
  daily_spend_cap                 NUMERIC,
  proposed_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at                    TIMESTAMPTZ,
  expires_at                      TIMESTAMPTZ,
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_a2a_org_collab_proposer ON a2a_org_collaborations(proposer_org_id);
CREATE INDEX IF NOT EXISTS idx_a2a_org_collab_responder ON a2a_org_collaborations(responder_org_id);
CREATE INDEX IF NOT EXISTS idx_a2a_org_collab_status ON a2a_org_collaborations(status);

-- ── Organization Audit Log ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_org_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES a2a_organizations(id) ON DELETE CASCADE,
  actor_agent_id  UUID NOT NULL REFERENCES agent_registry(id),
  action          TEXT NOT NULL,
  target_agent_id UUID REFERENCES agent_registry(id),
  details         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_a2a_org_audit_org ON a2a_org_audit(org_id);
CREATE INDEX IF NOT EXISTS idx_a2a_org_audit_actor ON a2a_org_audit(actor_agent_id);
CREATE INDEX IF NOT EXISTS idx_a2a_org_audit_action ON a2a_org_audit(action);
CREATE INDEX IF NOT EXISTS idx_a2a_org_audit_created ON a2a_org_audit(created_at DESC);

-- ── Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE a2a_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_org_collaborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_org_audit ENABLE ROW LEVEL SECURITY;

-- Service role has full access (API routes use service role)
CREATE POLICY "service_role_a2a_organizations" ON a2a_organizations
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_a2a_org_members" ON a2a_org_members
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_a2a_org_collaborations" ON a2a_org_collaborations
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_a2a_org_audit" ON a2a_org_audit
  FOR ALL USING (true) WITH CHECK (true);
