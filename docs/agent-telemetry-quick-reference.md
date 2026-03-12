# Agent Telemetry Quick Reference

One-page cheat sheet for using the intelligence cache and agent telemetry system.

---

## Basic Setup

```typescript
import { createClient } from '@supabase/supabase-js';
import { AgentRunContext, startAgentRun } from '@/lib/agent-telemetry';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

---

## Start Agent Run

```typescript
const runId = await startAgentRun(supabase, {
  agent_name: 'research_agent',
  agent_version: 'v1.0.0',
  user_id: userId,
  tenant_id: tenantId,
  purpose: 'Generate report',
  input_data: { topic: 'AI agents' }
});

const ctx = new AgentRunContext(supabase, runId);
```

---

## LLM Call with Cache

```typescript
import { generateCacheKey, checkCache, storeInCache, recordCacheHit } from '@/lib/agent-telemetry';

const cacheKey = generateCacheKey({ model, messages });
const cached = await checkCache(supabase, cacheKey);

if (cached) {
  await recordCacheHit(supabase, cacheKey, cached.original_cost_usd);
  await ctx.recordLLMCall(0, 0, cached.original_cost_usd, true);
  return cached.output_data;
}

// Make API call
const response = await anthropic.messages.create({ model, messages });
const cost = calculateCost(response.usage);

await storeInCache(supabase, {
  cache_key: cacheKey,
  cache_type: 'llm_response',
  input_data: { model, messages },
  output_data: response,
  original_cost_usd: cost,
  ttl_hours: 24,
  model,
  provider: 'anthropic'
});

await ctx.recordLLMCall(
  response.usage.input_tokens,
  response.usage.output_tokens,
  cost,
  false
);
```

---

## Tool Call Tracking

```typescript
import { recordToolUsage, calculateTavilyCost } from '@/lib/agent-telemetry';

const result = await tavilySearch(query);
const cost = calculateTavilyCost(1);

await recordToolUsage(supabase, runId, {
  tool_name: 'tavily_search',
  tool_provider: 'tavily',
  tool_operation: 'search',
  input_data: { query },
  output_data: result,
  units_consumed: 1,
  cost_usd: cost,
  latency_ms: responseTime
});

await ctx.recordToolCall('tavily_search', 'tavily', cost, false);
```

---

## Complete Run

```typescript
try {
  const result = await performWork();
  await ctx.complete('completed', result);
} catch (error) {
  await ctx.complete('failed', null, error.message);
}
```

---

## Cost Calculators

```typescript
import { 
  calculateTavilyCost,
  calculatePerplexityCost,
  calculateFirecrawlCost 
} from '@/lib/agent-telemetry';

const tavilyCost = calculateTavilyCost(5);      // 5 searches = $0.05
const perplexityCost = calculatePerplexityCost(10); // 10 requests = $0.05
const firecrawlCost = calculateFirecrawlCost(100);  // 100 pages = $0.10
```

---

## Useful Queries

### Get agent costs
```sql
SELECT * FROM agent_cost_summary 
WHERE agent_name = 'research_agent';
```

### Get user costs (last 7 days)
```sql
SELECT * FROM user_agent_costs 
WHERE user_id = 'user-123' 
  AND date > NOW() - INTERVAL '7 days'
ORDER BY date DESC;
```

### Check cache effectiveness
```sql
SELECT * FROM cache_effectiveness;
```

### Find expensive runs
```sql
SELECT run_id, agent_name, total_cost_usd, duration_ms
FROM agent_runs
WHERE total_cost_usd > 1.0
ORDER BY total_cost_usd DESC
LIMIT 10;
```

### Cache hit rate by agent
```sql
SELECT 
  agent_name,
  ROUND(100.0 * SUM(cache_hit_count) / 
    NULLIF(SUM(cache_hit_count + cache_miss_count), 0), 2) as hit_rate_pct
FROM agent_runs
GROUP BY agent_name;
```

---

## Maintenance

### Clean expired cache (run daily)
```sql
SELECT clean_expired_cache();
```

### Find stale cache entries
```sql
SELECT * FROM intelligence_cache 
WHERE is_stale = true OR expires_at < NOW();
```

---

## TTL Recommendations

| Cache Type | TTL | Reason |
|------------|-----|--------|
| LLM responses | 24h | Content stays relevant for a day |
| Search results | 1h | News/data changes frequently |
| Embeddings | 7d | Stable, expensive to regenerate |
| Tool outputs | 1-4h | Depends on data freshness needs |

---

## Common Patterns

### Pattern 1: Simple Agent
```typescript
const runId = await startAgentRun(supabase, { agent_name: 'simple_agent', user_id });
const ctx = new AgentRunContext(supabase, runId);
try {
  const result = await doWork(ctx);
  await ctx.complete('completed', result);
} catch (e) {
  await ctx.complete('failed', null, e.message);
}
```

### Pattern 2: Multi-Step Agent
```typescript
const ctx = new AgentRunContext(supabase, runId);

// Step 1: Search
const sources = await searchWithCache(query, ctx);

// Step 2: Analyze
const analysis = await analyzeWithLLM(sources, ctx);

// Step 3: Synthesize
const report = await synthesizeWithLLM(analysis, ctx);

await ctx.complete('completed', report);
```

### Pattern 3: Parallel Tool Calls
```typescript
const [search1, search2, search3] = await Promise.all([
  searchWithTracking('query1', ctx),
  searchWithTracking('query2', ctx),
  searchWithTracking('query3', ctx)
]);

// Metrics are automatically aggregated in ctx
```

---

## Debugging

### Check run status
```sql
SELECT run_id, status, error_message, duration_ms
FROM agent_runs
WHERE run_id = 'research-agent-123';
```

### View run costs breakdown
```sql
SELECT 
  run_id,
  llm_cost_usd,
  tool_cost_usd,
  cache_savings_usd,
  total_cost_usd,
  markup_cost_usd
FROM agent_runs
WHERE run_id = 'research-agent-123';
```

### List tool calls for a run
```sql
SELECT tool_name, cost_usd, latency_ms, cache_hit
FROM tool_usage
WHERE agent_run_id = (
  SELECT id FROM agent_runs WHERE run_id = 'research-agent-123'
);
```

---

## Performance Tips

1. **Cache expensive operations** — LLM calls, web scraping, embeddings
2. **Don't cache cheap operations** — Simple DB queries, calculations
3. **Use appropriate TTLs** — Balance freshness vs cost savings
4. **Monitor hit rates** — If <20%, reconsider caching strategy
5. **Flush metrics periodically** — For long-running agents, call `ctx.flush()` every 5-10 minutes
6. **Link tool usage to runs** — Always pass `agent_run_id` for audit trail

---

## Error Handling

```typescript
const ctx = new AgentRunContext(supabase, runId);

try {
  // Your agent logic
  const result = await performWork();
  await ctx.complete('completed', result);
  return result;
} catch (error) {
  console.error('Agent run failed:', error);
  await ctx.complete('failed', null, error.message);
  throw error;
} finally {
  // Ensure metrics are flushed even on unexpected errors
  await ctx.flush().catch(console.error);
}
```

---

## Files

- **Migration:** `supabase/migrations/20260312_intelligence_cache_and_telemetry.sql`
- **TypeScript:** `src/lib/agent-telemetry.ts`
- **Docs:** `docs/intelligence-cache-telemetry-schema.md`
- **Guide:** `docs/agent-telemetry-integration-guide.md`
- **Summary:** `docs/PHASE1_AGENTIC_FRAMEWORKS_SUMMARY.md`

