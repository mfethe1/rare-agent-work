# Agent Telemetry Integration Guide

This guide shows how to integrate the intelligence cache and agent telemetry system into your agentic workflows.

---

## Quick Start

### 1. Basic Agent Run with Telemetry

```typescript
import { createClient } from '@supabase/supabase-js';
import { 
  startAgentRun, 
  completeAgentRun, 
  AgentRunContext 
} from '@/lib/agent-telemetry';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runResearchAgent(topic: string, userId: string) {
  // Start tracking the run
  const runId = await startAgentRun(supabase, {
    agent_name: 'research_agent',
    agent_version: 'v1.0.0',
    user_id: userId,
    purpose: `Research report on ${topic}`,
    input_data: { topic, depth: 'comprehensive' }
  });

  // Create context for tracking metrics
  const ctx = new AgentRunContext(supabase, runId);

  try {
    // Your agent logic here
    const result = await performResearch(topic, ctx);

    // Complete successfully
    await ctx.complete('completed', result);
    
    return result;
  } catch (error) {
    // Complete with error
    await ctx.complete('failed', null, error.message);
    throw error;
  }
}
```

### 2. LLM Call with Caching

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { 
  generateCacheKey, 
  checkCache, 
  storeInCache, 
  recordCacheHit 
} from '@/lib/agent-telemetry';
import { calculateModelCost } from '@/lib/cost-gate';

async function callLLMWithCache(
  messages: any[],
  model: string,
  ctx: AgentRunContext
) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  
  // Generate cache key
  const cacheKey = generateCacheKey({ model, messages });
  
  // Check cache first
  const cached = await checkCache(supabase, cacheKey);
  if (cached) {
    console.log('Cache hit!');
    const cost = cached.original_cost_usd;
    
    // Record cache hit
    await recordCacheHit(supabase, cacheKey, cost);
    await ctx.recordLLMCall(0, 0, cost, true);
    
    return cached.output_data;
  }
  
  // Cache miss - make API call
  console.log('Cache miss - calling API');
  const response = await anthropic.messages.create({
    model,
    messages,
    max_tokens: 4096
  });
  
  // Calculate cost
  const { providerCost } = calculateModelCost(
    model,
    response.usage.input_tokens,
    response.usage.output_tokens
  );
  
  // Store in cache (24h TTL)
  await storeInCache(supabase, {
    cache_key: cacheKey,
    cache_type: 'llm_response',
    input_data: { model, messages },
    output_data: response,
    original_cost_usd: providerCost,
    ttl_hours: 24,
    model,
    provider: 'anthropic'
  });
  
  // Record metrics
  await ctx.recordLLMCall(
    response.usage.input_tokens,
    response.usage.output_tokens,
    providerCost,
    false
  );
  
  return response;
}
```

### 3. Tool Call with Cost Tracking

```typescript
import { recordToolUsage, calculateTavilyCost } from '@/lib/agent-telemetry';

async function searchWithTavily(
  query: string,
  agentRunId: string,
  ctx: AgentRunContext
) {
  const startTime = Date.now();
  
  // Make Tavily API call
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`
    },
    body: JSON.stringify({
      query,
      max_results: 10
    })
  });
  
  const result = await response.json();
  const latency = Date.now() - startTime;
  const cost = calculateTavilyCost(1); // 1 search = $0.01
  
  // Record tool usage
  await recordToolUsage(supabase, agentRunId, {
    tool_name: 'tavily_search',
    tool_provider: 'tavily',
    tool_operation: 'search',
    input_data: { query, max_results: 10 },
    output_data: result,
    units_consumed: 1,
    cost_usd: cost,
    latency_ms: latency,
    cache_hit: false
  });
  
  // Update run context
  await ctx.recordToolCall('tavily_search', 'tavily', cost, false);
  
  return result;
}
```

### 4. Complete Example: Research Agent with Caching

```typescript
async function performResearch(topic: string, ctx: AgentRunContext) {
  // Step 1: Search for sources (with caching)
  const searchCacheKey = generateCacheKey({ tool: 'tavily', query: topic });
  let sources = await checkCache(supabase, searchCacheKey);
  
  if (!sources) {
    sources = await searchWithTavily(topic, ctx.runId, ctx);
    await storeInCache(supabase, {
      cache_key: searchCacheKey,
      cache_type: 'tool_output',
      input_data: { query: topic },
      output_data: sources,
      original_cost_usd: 0.01,
      ttl_hours: 1, // Search results expire quickly
      tool_name: 'tavily_search',
      provider: 'tavily'
    });
  } else {
    await recordCacheHit(supabase, searchCacheKey, 0.01);
    await ctx.recordToolCall('tavily_search', 'tavily', 0.01, true);
  }
  
  // Step 2: Synthesize with LLM (with caching)
  const report = await callLLMWithCache(
    [
      { role: 'user', content: `Synthesize a report on ${topic} using these sources: ${JSON.stringify(sources)}` }
    ],
    'claude-sonnet-4-6',
    ctx
  );
  
  return report;
}
```

---

## Cost Analysis Queries

### Get total costs by agent type
```sql
SELECT * FROM agent_cost_summary 
ORDER BY total_cost DESC;
```

### Get user's daily costs
```sql
SELECT * FROM user_agent_costs 
WHERE user_id = 'user-123' 
ORDER BY date DESC 
LIMIT 30;
```

### Check cache effectiveness
```sql
SELECT 
  cache_type,
  total_entries,
  total_reuses,
  total_savings,
  ROUND(avg_reuses_per_entry, 2) as avg_reuses
FROM cache_effectiveness
ORDER BY total_savings DESC;
```

### Find most expensive tool calls
```sql
SELECT 
  tool_name,
  COUNT(*) as calls,
  SUM(cost_usd) as total_cost,
  AVG(latency_ms) as avg_latency
FROM tool_usage
GROUP BY tool_name
ORDER BY total_cost DESC;
```

---

## Maintenance

### Clean expired cache entries (run daily)
```sql
SELECT clean_expired_cache();
```

### Monitor cache hit rate
```sql
SELECT 
  agent_name,
  SUM(cache_hit_count) as hits,
  SUM(cache_miss_count) as misses,
  ROUND(100.0 * SUM(cache_hit_count) / NULLIF(SUM(cache_hit_count + cache_miss_count), 0), 2) as hit_rate_pct
FROM agent_runs
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY agent_name;
```

---

## Best Practices

1. **Always use AgentRunContext** — It automatically tracks metrics and flushes on completion
2. **Set appropriate TTLs** — LLM responses: 24h, search results: 1h, embeddings: 7d
3. **Cache at the right level** — Cache expensive operations, not cheap ones
4. **Monitor cache effectiveness** — If hit rate < 20%, reconsider caching strategy
5. **Link tool usage to runs** — Always pass `agent_run_id` to maintain audit trail
6. **Flush metrics regularly** — Call `ctx.flush()` periodically for long-running agents
7. **Handle errors gracefully** — Always call `ctx.complete()` even on failure

---

## Next Steps

1. Apply the migration: `npx supabase db push`
2. Update your agent code to use `AgentRunContext`
3. Set up a daily cron job to run `clean_expired_cache()`
4. Build a cost dashboard using the aggregate views
5. Monitor cache hit rates and adjust TTLs accordingly

