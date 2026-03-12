-- ============================================================================
-- Intelligence Cache & Enhanced Telemetry/Cost-Tracking Schema
-- Phase 1 Agentic Frameworks
-- ============================================================================
-- Purpose:
-- 1. intelligence_cache: Cache LLM responses and tool outputs to reduce costs
-- 2. agent_runs: Track complete agent execution runs with full telemetry
-- 3. tool_usage: Track external tool/API costs (Tavily, Perplexity, etc.)
-- 4. Enhanced cost tracking per run with multi-source cost aggregation
-- ============================================================================

-- ============================================================================
-- 1. Intelligence Cache Table
-- ============================================================================
-- Caches LLM responses and tool outputs to avoid redundant API calls
-- Key design: hash-based lookup with TTL and hit tracking

CREATE TABLE IF NOT EXISTS public.intelligence_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Cache key (hash of input)
  cache_key TEXT NOT NULL UNIQUE,
  cache_type TEXT NOT NULL CHECK (cache_type IN ('llm_response', 'tool_output', 'search_result', 'embedding')),
  
  -- Input context (for debugging/auditing)
  input_hash TEXT NOT NULL,
  input_preview TEXT, -- First 500 chars of input for human readability
  
  -- Cached output
  output_data JSONB NOT NULL,
  output_tokens INTEGER DEFAULT 0,
  
  -- Metadata
  model TEXT, -- e.g., 'claude-sonnet-4-6', 'gpt-4', null for non-LLM
  tool_name TEXT, -- e.g., 'tavily_search', 'perplexity_sonar', null for LLM
  provider TEXT, -- 'anthropic', 'openai', 'tavily', 'perplexity'
  
  -- Cost savings tracking
  original_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  times_reused INTEGER NOT NULL DEFAULT 0,
  total_savings_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  
  -- TTL and freshness
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Tenant isolation
  tenant_id TEXT, -- null = public/shared cache
  
  -- Quality/confidence
  confidence_score NUMERIC(3,2), -- 0.00-1.00, for search results
  is_stale BOOLEAN DEFAULT false
);

-- Indexes for cache lookups
CREATE INDEX IF NOT EXISTS idx_intelligence_cache_key ON public.intelligence_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_intelligence_cache_type ON public.intelligence_cache(cache_type);
CREATE INDEX IF NOT EXISTS idx_intelligence_cache_expires ON public.intelligence_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_intelligence_cache_tenant ON public.intelligence_cache(tenant_id);

-- RLS
ALTER TABLE public.intelligence_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service can manage cache" ON public.intelligence_cache FOR ALL USING (true);

-- ============================================================================
-- 2. Agent Runs Table
-- ============================================================================
-- Tracks complete agent execution runs with full telemetry and cost breakdown

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Run identification
  run_id TEXT NOT NULL UNIQUE, -- Human-readable run ID
  agent_name TEXT NOT NULL, -- e.g., 'research_agent', 'news_curator'
  agent_version TEXT, -- e.g., 'v1.2.0'
  
  -- Execution context
  user_id TEXT, -- Can be UUID or anonymous identifier
  tenant_id TEXT, -- For multi-tenant isolation
  session_id TEXT, -- Links to agent session
  
  -- Run metadata
  purpose TEXT, -- Why this run happened
  input_data JSONB, -- Input parameters/context
  output_data JSONB, -- Final output/result
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'timeout')),
  error_message TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER, -- Computed on completion
  
  -- Token usage (aggregated across all LLM calls in this run)
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  
  -- Cost breakdown
  llm_cost_usd NUMERIC(10,6) DEFAULT 0, -- Total LLM API costs
  tool_cost_usd NUMERIC(10,6) DEFAULT 0, -- Total external tool costs (Tavily, etc.)
  cache_savings_usd NUMERIC(10,6) DEFAULT 0, -- Savings from cache hits
  total_cost_usd NUMERIC(10,6) DEFAULT 0, -- llm_cost + tool_cost
  markup_cost_usd NUMERIC(10,6) DEFAULT 0, -- Billed cost (with markup)
  
  -- Performance metrics
  cache_hit_count INTEGER DEFAULT 0,
  cache_miss_count INTEGER DEFAULT 0,
  tool_call_count INTEGER DEFAULT 0,
  llm_call_count INTEGER DEFAULT 0,
  
  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_runs_run_id ON public.agent_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user ON public.agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_tenant ON public.agent_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON public.agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started ON public.agent_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_name ON public.agent_runs(agent_name);

-- RLS
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service can manage runs" ON public.agent_runs FOR ALL USING (true);
CREATE POLICY "Users can view own runs" ON public.agent_runs FOR SELECT USING (auth.uid()::text = user_id);

-- ============================================================================
-- 3. Tool Usage Table
-- ============================================================================
-- Tracks external tool/API usage and costs (Tavily, Perplexity, Firecrawl, etc.)

CREATE TABLE IF NOT EXISTS public.tool_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Links to agent run
  agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  
  -- Tool identification
  tool_name TEXT NOT NULL, -- 'tavily_search', 'perplexity_sonar', 'firecrawl'
  tool_provider TEXT NOT NULL, -- 'tavily', 'perplexity', 'firecrawl'
  tool_operation TEXT, -- 'search', 'scrape', 'summarize'
  
  -- Usage details
  input_data JSONB, -- Query/parameters
  output_data JSONB, -- Results
  
  -- Cost tracking
  units_consumed INTEGER, -- API-specific units (searches, pages, tokens)
  cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  
  -- Performance
  latency_ms INTEGER,
  cache_hit BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tool_usage_run ON public.tool_usage(agent_run_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_tool ON public.tool_usage(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_usage_created ON public.tool_usage(created_at DESC);

-- RLS
ALTER TABLE public.tool_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service can manage tool usage" ON public.tool_usage FOR ALL USING (true);

-- ============================================================================
-- 4. Aggregate Views for Cost Analysis
-- ============================================================================

-- Agent run cost summary by agent type
CREATE OR REPLACE VIEW agent_cost_summary AS
SELECT
  agent_name,
  agent_version,
  COUNT(*) AS total_runs,
  COUNT(*) FILTER (WHERE status = 'completed') AS successful_runs,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_runs,
  AVG(duration_ms) AS avg_duration_ms,
  SUM(total_tokens) AS total_tokens,
  SUM(llm_cost_usd) AS total_llm_cost,
  SUM(tool_cost_usd) AS total_tool_cost,
  SUM(total_cost_usd) AS total_cost,
  SUM(cache_savings_usd) AS total_cache_savings,
  AVG(cache_hit_count::float / NULLIF(cache_hit_count + cache_miss_count, 0)) AS avg_cache_hit_rate,
  MAX(started_at) AS last_run_at
FROM agent_runs
GROUP BY agent_name, agent_version;

-- User/tenant cost breakdown
CREATE OR REPLACE VIEW user_agent_costs AS
SELECT
  user_id,
  tenant_id,
  date_trunc('day', started_at) AS date,
  COUNT(*) AS run_count,
  SUM(total_tokens) AS total_tokens,
  SUM(llm_cost_usd) AS llm_cost,
  SUM(tool_cost_usd) AS tool_cost,
  SUM(total_cost_usd) AS total_cost,
  SUM(markup_cost_usd) AS billed_cost,
  SUM(cache_savings_usd) AS cache_savings
FROM agent_runs
WHERE user_id IS NOT NULL
GROUP BY user_id, tenant_id, date_trunc('day', started_at);

-- Tool usage summary
CREATE OR REPLACE VIEW tool_cost_summary AS
SELECT
  tool_name,
  tool_provider,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE cache_hit = true) AS cache_hits,
  SUM(units_consumed) AS total_units,
  SUM(cost_usd) AS total_cost,
  AVG(latency_ms) AS avg_latency_ms,
  MAX(created_at) AS last_used_at
FROM tool_usage
GROUP BY tool_name, tool_provider;

-- Cache effectiveness
CREATE OR REPLACE VIEW cache_effectiveness AS
SELECT
  cache_type,
  provider,
  COUNT(*) AS total_entries,
  SUM(times_reused) AS total_reuses,
  SUM(total_savings_usd) AS total_savings,
  AVG(times_reused) AS avg_reuses_per_entry,
  COUNT(*) FILTER (WHERE is_stale = true) AS stale_entries,
  COUNT(*) FILTER (WHERE expires_at < NOW()) AS expired_entries
FROM intelligence_cache
GROUP BY cache_type, provider;

-- ============================================================================
-- 5. Helper Functions
-- ============================================================================

-- Function to update agent run on completion
CREATE OR REPLACE FUNCTION complete_agent_run(
  p_run_id TEXT,
  p_status TEXT,
  p_output_data JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  UPDATE agent_runs
  SET
    status = p_status,
    output_data = COALESCE(p_output_data, output_data),
    error_message = p_error_message,
    completed_at = NOW(),
    duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
    updated_at = NOW()
  WHERE run_id = p_run_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment cache hit
CREATE OR REPLACE FUNCTION increment_cache_hit(p_cache_key TEXT, p_cost_saved NUMERIC) RETURNS void AS $$
BEGIN
  UPDATE intelligence_cache
  SET
    times_reused = times_reused + 1,
    total_savings_usd = total_savings_usd + p_cost_saved,
    last_accessed_at = NOW()
  WHERE cache_key = p_cache_key;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM intelligence_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_runs_updated_at
  BEFORE UPDATE ON agent_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. Comments for Documentation
-- ============================================================================

COMMENT ON TABLE intelligence_cache IS 'Caches LLM responses and tool outputs to reduce API costs and improve latency';
COMMENT ON TABLE agent_runs IS 'Tracks complete agent execution runs with full telemetry and cost breakdown';
COMMENT ON TABLE tool_usage IS 'Tracks external tool/API usage and costs (Tavily, Perplexity, Firecrawl, etc.)';

COMMENT ON COLUMN intelligence_cache.cache_key IS 'Hash-based unique key for cache lookup';
COMMENT ON COLUMN intelligence_cache.times_reused IS 'Number of times this cache entry has been reused';
COMMENT ON COLUMN intelligence_cache.total_savings_usd IS 'Total cost savings from cache reuse';

COMMENT ON COLUMN agent_runs.run_id IS 'Human-readable run identifier for debugging';
COMMENT ON COLUMN agent_runs.cache_savings_usd IS 'Cost savings from cache hits during this run';
COMMENT ON COLUMN agent_runs.markup_cost_usd IS 'Billed cost with markup applied';

COMMENT ON COLUMN tool_usage.units_consumed IS 'Provider-specific units (searches, pages, tokens, etc.)';
COMMENT ON COLUMN tool_usage.cache_hit IS 'Whether this tool call was served from cache';

