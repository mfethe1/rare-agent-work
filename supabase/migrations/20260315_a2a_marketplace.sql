-- Agent Capability Marketplace & Package Registry
-- The "npm for agents" — publish, discover, install, rate, and monetize
-- reusable capability packages in the rareagent.work A2A ecosystem.

-- ── Marketplace Packages ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_marketplace_packages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,          -- @publisher/package-name
  display_name  TEXT NOT NULL,
  description   TEXT NOT NULL,
  version       TEXT NOT NULL,                 -- current semver
  publisher_agent_id UUID NOT NULL,
  publisher_name TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','in_review','published','suspended','deprecated','archived')),
  visibility    TEXT NOT NULL DEFAULT 'public'
                CHECK (visibility IN ('public','unlisted','private','org-only')),
  category      TEXT NOT NULL
                CHECK (category IN ('data-retrieval','data-transformation','analysis','generation',
                  'communication','integration','security','orchestration','monitoring','utility')),
  tags          JSONB NOT NULL DEFAULT '[]',
  pricing       JSONB NOT NULL,
  capabilities  JSONB NOT NULL DEFAULT '[]',   -- capability IDs provided
  input_schema  JSONB,
  output_schema JSONB,
  dependencies  JSONB NOT NULL DEFAULT '[]',   -- package name references
  min_sdk_version TEXT,
  quality_score INTEGER NOT NULL DEFAULT 0,
  metrics       JSONB NOT NULL DEFAULT '{
    "total_installs": 0, "active_installs": 0, "total_invocations": 0,
    "avg_latency_ms": 0, "success_rate": 1, "avg_rating": 0,
    "review_count": 0, "total_revenue_credits": 0
  }'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at  TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ
);

CREATE INDEX idx_marketplace_packages_status ON a2a_marketplace_packages(status);
CREATE INDEX idx_marketplace_packages_category ON a2a_marketplace_packages(category);
CREATE INDEX idx_marketplace_packages_publisher ON a2a_marketplace_packages(publisher_agent_id);
CREATE INDEX idx_marketplace_packages_quality ON a2a_marketplace_packages(quality_score DESC);
CREATE INDEX idx_marketplace_packages_name_search ON a2a_marketplace_packages USING gin(to_tsvector('english', name || ' ' || display_name || ' ' || description));

-- ── Package Versions ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_marketplace_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id    UUID NOT NULL REFERENCES a2a_marketplace_packages(id) ON DELETE CASCADE,
  version       TEXT NOT NULL,
  changelog     TEXT NOT NULL DEFAULT '',
  input_schema  JSONB,
  output_schema JSONB,
  dependencies  JSONB NOT NULL DEFAULT '[]',
  verified      BOOLEAN NOT NULL DEFAULT false,
  install_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(package_id, version)
);

CREATE INDEX idx_marketplace_versions_package ON a2a_marketplace_versions(package_id);

-- ── Installations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_marketplace_installations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id        UUID NOT NULL REFERENCES a2a_marketplace_packages(id) ON DELETE CASCADE,
  package_name      TEXT NOT NULL,
  installed_version TEXT NOT NULL,
  agent_id          UUID NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','suspended','uninstalled')),
  invocation_count  INTEGER NOT NULL DEFAULT 0,
  last_invoked_at   TIMESTAMPTZ,
  auto_update       BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketplace_installs_agent ON a2a_marketplace_installations(agent_id, status);
CREATE INDEX idx_marketplace_installs_package ON a2a_marketplace_installations(package_id, status);
CREATE UNIQUE INDEX idx_marketplace_installs_unique_active
  ON a2a_marketplace_installations(package_id, agent_id) WHERE status = 'active';

-- ── Reviews ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_marketplace_reviews (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id           UUID NOT NULL REFERENCES a2a_marketplace_packages(id) ON DELETE CASCADE,
  reviewer_agent_id    UUID NOT NULL,
  reviewer_name        TEXT NOT NULL,
  rating               INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title                TEXT NOT NULL,
  body                 TEXT NOT NULL,
  verified_usage       BOOLEAN NOT NULL DEFAULT false,
  usage_count_at_review INTEGER NOT NULL DEFAULT 0,
  helpful_count        INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(package_id, reviewer_agent_id)
);

CREATE INDEX idx_marketplace_reviews_package ON a2a_marketplace_reviews(package_id);
CREATE INDEX idx_marketplace_reviews_rating ON a2a_marketplace_reviews(package_id, rating);

-- ── Helper RPCs ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_marketplace_installs(p_package_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE a2a_marketplace_packages
  SET metrics = jsonb_set(
    jsonb_set(metrics, '{total_installs}', to_jsonb((metrics->>'total_installs')::int + 1)),
    '{active_installs}', to_jsonb((metrics->>'active_installs')::int + 1)
  ),
  updated_at = now()
  WHERE id = p_package_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_marketplace_installs(p_package_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE a2a_marketplace_packages
  SET metrics = jsonb_set(
    metrics, '{active_installs}',
    to_jsonb(GREATEST(0, (metrics->>'active_installs')::int - 1))
  ),
  updated_at = now()
  WHERE id = p_package_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_marketplace_rating(
  p_package_id UUID,
  p_avg_rating NUMERIC,
  p_review_count INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE a2a_marketplace_packages
  SET metrics = jsonb_set(
    jsonb_set(metrics, '{avg_rating}', to_jsonb(p_avg_rating)),
    '{review_count}', to_jsonb(p_review_count)
  ),
  updated_at = now()
  WHERE id = p_package_id;
END;
$$ LANGUAGE plpgsql;
