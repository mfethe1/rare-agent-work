-- ──────────────────────────────────────────────
-- A2A Capability Versioning & Migration Paths
-- ──────────────────────────────────────────────
-- Enables semver-based capability versioning with deprecation lifecycle,
-- version negotiation between agents, and migration path registration
-- for cross-version interoperability.

-- Capability Version Registry
CREATE TABLE IF NOT EXISTS a2a_capability_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id TEXT NOT NULL,
  version       TEXT NOT NULL,
  major         INT  NOT NULL,
  minor         INT  NOT NULL,
  patch         INT  NOT NULL,
  prerelease    TEXT,
  lifecycle     TEXT NOT NULL DEFAULT 'active'
                     CHECK (lifecycle IN ('active', 'deprecated', 'sunset', 'removed')),
  changelog     TEXT NOT NULL DEFAULT '',
  published_by_agent_id UUID NOT NULL REFERENCES agent_registry(id),
  input_schema  JSONB,
  output_schema JSONB,
  deprecated_at TIMESTAMPTZ,
  sunset_at     TIMESTAMPTZ,
  deprecation_message TEXT,
  recommended_version TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One version string per capability
  UNIQUE(capability_id, version)
);

-- Indexes for common query patterns
CREATE INDEX idx_cap_versions_capability ON a2a_capability_versions(capability_id);
CREATE INDEX idx_cap_versions_lifecycle  ON a2a_capability_versions(lifecycle);
CREATE INDEX idx_cap_versions_agent      ON a2a_capability_versions(published_by_agent_id);
CREATE INDEX idx_cap_versions_sunset     ON a2a_capability_versions(sunset_at)
  WHERE lifecycle = 'deprecated' AND sunset_at IS NOT NULL;

-- Composite index for version ordering queries
CREATE INDEX idx_cap_versions_semver ON a2a_capability_versions(capability_id, major DESC, minor DESC, patch DESC);

-- Enable RLS
ALTER TABLE a2a_capability_versions ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access on capability versions"
  ON a2a_capability_versions FOR ALL
  USING (auth.role() = 'service_role');


-- Migration Paths between capability versions
CREATE TABLE IF NOT EXISTS a2a_migration_paths (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id    TEXT NOT NULL,
  from_version     TEXT NOT NULL,
  to_version       TEXT NOT NULL,
  bidirectional    BOOLEAN NOT NULL DEFAULT false,
  input_transforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_transforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  registered_by    UUID NOT NULL REFERENCES agent_registry(id),
  validated        BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One migration per version pair per capability
  UNIQUE(capability_id, from_version, to_version)
);

CREATE INDEX idx_migration_paths_capability ON a2a_migration_paths(capability_id);
CREATE INDEX idx_migration_paths_from       ON a2a_migration_paths(capability_id, from_version);
CREATE INDEX idx_migration_paths_to         ON a2a_migration_paths(capability_id, to_version);

-- Enable RLS
ALTER TABLE a2a_migration_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on migration paths"
  ON a2a_migration_paths FOR ALL
  USING (auth.role() = 'service_role');


-- Version Negotiation Logs (for audit and analytics)
CREATE TABLE IF NOT EXISTS a2a_version_negotiations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id       TEXT NOT NULL,
  consumer_agent_id   UUID NOT NULL REFERENCES agent_registry(id),
  provider_agent_id   UUID NOT NULL REFERENCES agent_registry(id),
  success             BOOLEAN NOT NULL,
  consumer_version    TEXT,
  provider_version    TEXT,
  compatibility_level TEXT,
  requires_migration  BOOLEAN NOT NULL DEFAULT false,
  migration_path_id   UUID REFERENCES a2a_migration_paths(id),
  failure_reason      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_negotiations_consumer ON a2a_version_negotiations(consumer_agent_id);
CREATE INDEX idx_negotiations_provider ON a2a_version_negotiations(provider_agent_id);
CREATE INDEX idx_negotiations_cap      ON a2a_version_negotiations(capability_id);

ALTER TABLE a2a_version_negotiations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on version negotiations"
  ON a2a_version_negotiations FOR ALL
  USING (auth.role() = 'service_role');
