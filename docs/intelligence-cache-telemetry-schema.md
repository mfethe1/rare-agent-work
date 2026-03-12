# Intelligence Cache & Telemetry Schema

**Migration:** `20260312_intelligence_cache_and_telemetry.sql`  
**Phase:** Phase 1 Agentic Frameworks  
**Purpose:** Cost optimization, observability, and multi-source cost tracking for agent systems

---

## Overview

This schema provides three core capabilities for production agentic systems:

1. **Intelligence Cache** — Reduce LLM and tool API costs by caching responses
2. **Agent Run Telemetry** — Track complete agent executions with full cost breakdown
3. **Tool Usage Tracking** — Monitor external API costs (Tavily, Perplexity, Firecrawl, etc.)

---

## Tables

### 1. `intelligence_cache`

Caches LLM responses and tool outputs to avoid redundant API calls.

**Key Features:**
- Hash-based cache key for deterministic lookups
- TTL-based expiration with automatic cleanup
- Tracks reuse count and cost savings
- Supports multiple cache types: `llm_response`, `tool_output`, `search_result`, `embedding`
- Tenant-scoped for multi-tenant isolation

**Schema:**
```sql
cache_key TEXT UNIQUE          -- Hash of input (e.g., SHA256)
cache_type TEXT                -- 'llm_response' | 'tool_output' | 'search_result' | 'embedding'
input_hash TEXT                -- Hash for deduplication
output_data JSONB              -- Cached response
original_cost_usd NUMERIC      -- Cost of original API call
times_reused INTEGER           -- Number of cache hits
total_savings_usd NUMERIC      -- Cumulative savings
expires_at TIMESTAMPTZ         -- TTL expiration
tenant_id TEXT                 -- For multi-tenant isolation (null = shared)
```

**Usage Example:**
```typescript
// Before making an LLM call, check cache
const cacheKey = sha256(JSON.stringify({ model, messages }));
const cached = await supabase
  .from('intelligence_cache')
  .select('output_data')
  .eq('cache_key', cacheKey)
  .gt('expires_at', new Date().toISOString())
  .single();

if (cached.data) {
  // Cache hit - increment reuse counter
  await supabase.rpc('increment_cache_hit', { 
    p_cache_key: cacheKey, 
    p_cost_saved: estimatedCost 
  });
  return cached.data.output_data;
}

// Cache miss - make API call and store
const response = await anthropic.messages.create(...);
await supabase.from('intelligence_cache').insert({
  cache_key: cacheKey,
  cache_type: 'llm_response',
  input_hash: cacheKey,
  output_data: response,
  original_cost_usd: calculateCost(response.usage),
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h TTL
  model: 'claude-sonnet-4-6',
  provider: 'anthropic'
});
```

---

### 2. `agent_runs`

Tracks complete agent execution runs with full telemetry and cost breakdown.

**Key Features:**
- Aggregates all LLM and tool costs per run
- Tracks cache hit/miss rates
- Records execution timing and status
- Links to user/tenant for cost attribution
- Supports cost markup for billing

**Schema:**
```sql
run_id TEXT UNIQUE             -- Human-readable ID (e.g., 'research-2026-03-12-abc123')
agent_name TEXT                -- 'research_agent', 'news_curator', etc.
user_id TEXT                   -- User or anonymous ID
tenant_id TEXT                 -- Tenant for isolation
status TEXT                    -- 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout'
total_input_tokens INTEGER     -- Aggregated across all LLM calls
total_output_tokens INTEGER    -- Aggregated across all LLM calls
llm_cost_usd NUMERIC           -- Total LLM API costs
tool_cost_usd NUMERIC          -- Total external tool costs
cache_savings_usd NUMERIC      -- Savings from cache hits
total_cost_usd NUMERIC         -- llm_cost + tool_cost
markup_cost_usd NUMERIC        -- Billed cost (with markup)
cache_hit_count INTEGER        -- Number of cache hits
cache_miss_count INTEGER       -- Number of cache misses
duration_ms INTEGER            -- Total execution time
```

**Usage Example:**
```typescript
// Start agent run
const runId = `research-${Date.now()}-${randomId()}`;
await supabase.from('agent_runs').insert({
  run_id: runId,
  agent_name: 'research_agent',
  agent_version: 'v1.0.0',
  user_id: userId,
  tenant_id: tenantId,
  purpose: 'Generate AI agent market report',
  input_data: { topic: 'AI agents', depth: 'comprehensive' },
  status: 'running'
});

// During execution, track costs
let totalLlmCost = 0;
let totalToolCost = 0;
let cacheHits = 0;

// ... agent execution ...

// Complete run
await supabase.rpc('complete_agent_run', {
  p_run_id: runId,
  p_status: 'completed',
  p_output_data: { report_url: '/reports/ai-agents' }
});

await supabase.from('agent_runs')
  .update({
    llm_cost_usd: totalLlmCost,
    tool_cost_usd: totalToolCost,
    total_cost_usd: totalLlmCost + totalToolCost,
    markup_cost_usd: (totalLlmCost + totalToolCost) * 1.30,
    cache_hit_count: cacheHits
  })
  .eq('run_id', runId);
```

---

### 3. `tool_usage`

Tracks external tool/API usage and costs (Tavily, Perplexity, Firecrawl, etc.).

**Key Features:**
- Links to parent agent run
- Tracks provider-specific units (searches, pages, tokens)
- Records latency for performance monitoring
- Supports cache hit tracking

**Schema:**
```sql
agent_run_id UUID              -- Links to agent_runs table
tool_name TEXT                 -- 'tavily_search', 'perplexity_sonar', 'firecrawl'
tool_provider TEXT             -- 'tavily', 'perplexity', 'firecrawl'
tool_operation TEXT            -- 'search', 'scrape', 'summarize'
input_data JSONB               -- Query/parameters
output_data JSONB              -- Results
units_consumed INTEGER         -- Provider-specific units
cost_usd NUMERIC               -- Cost of this call
latency_ms INTEGER             -- Response time
cache_hit BOOLEAN              -- Whether served from cache
```

**Usage Example:**
```typescript
// Track Tavily search
const tavilyResult = await tavily.search(query);
await supabase.from('tool_usage').insert({
  agent_run_id: currentRunId,
  tool_name: 'tavily_search',
  tool_provider: 'tavily',
  tool_operation: 'search',
  input_data: { query, max_results: 10 },
  output_data: tavilyResult,
  units_consumed: 1, // 1 search
  cost_usd: 0.01, // Tavily pricing
  latency_ms: responseTime,
  cache_hit: false
});
```

---

## Aggregate Views

### `agent_cost_summary`
Cost breakdown by agent type:
```sql
SELECT * FROM agent_cost_summary WHERE agent_name = 'research_agent';
```

### `user_agent_costs`
Daily cost breakdown per user/tenant:
```sql
SELECT * FROM user_agent_costs WHERE user_id = 'user-123' ORDER BY date DESC;
```

### `tool_cost_summary`
Tool usage and cost summary:
```sql
SELECT * FROM tool_cost_summary ORDER BY total_cost DESC;
```

### `cache_effectiveness`
Cache hit rates and savings:
```sql
SELECT * FROM cache_effectiveness;
```

---

## Helper Functions

### `complete_agent_run(run_id, status, output_data, error_message)`
Marks an agent run as complete and calculates duration.

### `increment_cache_hit(cache_key, cost_saved)`
Increments cache reuse counter and savings.

### `clean_expired_cache()`
Removes expired cache entries. Run periodically via cron.

---

## Cost Tracking Best Practices

1. **Always link tool usage to agent runs** — Use `agent_run_id` foreign key
2. **Track cache hits separately** — Don't double-count cached responses
3. **Apply markup at billing time** — Store provider cost and markup cost separately
4. **Set appropriate TTLs** — LLM responses: 24h, search results: 1h, embeddings: 7d
5. **Monitor cache effectiveness** — Use `cache_effectiveness` view to optimize TTLs
6. **Clean expired cache regularly** — Run `clean_expired_cache()` daily

---

## Integration with Existing `token_usage` Table

The new schema complements the existing `token_usage` table:

- **`token_usage`** — Per-request LLM token tracking (fine-grained)
- **`agent_runs`** — Per-run aggregated costs (coarse-grained, includes tools)

For agent systems, use `agent_runs` as the primary cost tracking mechanism and optionally link individual LLM calls to `token_usage` for detailed debugging.

---

## Next Steps

1. Apply migration: `npx supabase db push`
2. Update agent execution code to create `agent_runs` records
3. Implement cache lookup logic in LLM/tool wrappers
4. Set up cron job to run `clean_expired_cache()` daily
5. Build cost dashboard using aggregate views

