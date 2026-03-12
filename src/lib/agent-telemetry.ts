/**
 * Agent Telemetry & Intelligence Cache
 * 
 * TypeScript utilities for working with the intelligence_cache and agent_runs tables.
 * Provides type-safe interfaces and helper functions for cost tracking and caching.
 */

import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export type CacheType = 'llm_response' | 'tool_output' | 'search_result' | 'embedding';
export type AgentRunStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface IntelligenceCacheEntry {
  id: string;
  cache_key: string;
  cache_type: CacheType;
  input_hash: string;
  input_preview?: string;
  output_data: any;
  output_tokens?: number;
  model?: string;
  tool_name?: string;
  provider?: string;
  original_cost_usd: number;
  times_reused: number;
  total_savings_usd: number;
  created_at: string;
  expires_at: string;
  last_accessed_at: string;
  tenant_id?: string;
  confidence_score?: number;
  is_stale: boolean;
}

export interface AgentRun {
  id: string;
  run_id: string;
  agent_name: string;
  agent_version?: string;
  user_id?: string;
  tenant_id?: string;
  session_id?: string;
  purpose?: string;
  input_data?: any;
  output_data?: any;
  status: AgentRunStatus;
  error_message?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  llm_cost_usd: number;
  tool_cost_usd: number;
  cache_savings_usd: number;
  total_cost_usd: number;
  markup_cost_usd: number;
  cache_hit_count: number;
  cache_miss_count: number;
  tool_call_count: number;
  llm_call_count: number;
  created_at: string;
  updated_at: string;
}

export interface ToolUsage {
  id: string;
  agent_run_id: string;
  tool_name: string;
  tool_provider: string;
  tool_operation?: string;
  input_data?: any;
  output_data?: any;
  units_consumed?: number;
  cost_usd: number;
  latency_ms?: number;
  cache_hit: boolean;
  created_at: string;
}

// ============================================================================
// Cache Utilities
// ============================================================================

/**
 * Generate a deterministic cache key from input data
 */
export function generateCacheKey(input: any): string {
  const normalized = JSON.stringify(input, Object.keys(input).sort());
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Check cache for existing entry
 */
export async function checkCache(
  supabase: ReturnType<typeof createClient>,
  cacheKey: string
): Promise<IntelligenceCacheEntry | null> {
  const { data, error } = await supabase
    .from('intelligence_cache')
    .select('*')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .eq('is_stale', false)
    .single();

  if (error || !data) return null;
  return data as IntelligenceCacheEntry;
}

/**
 * Store entry in cache
 */
export async function storeInCache(
  supabase: ReturnType<typeof createClient>,
  entry: {
    cache_key: string;
    cache_type: CacheType;
    input_data: any;
    output_data: any;
    original_cost_usd: number;
    ttl_hours?: number;
    model?: string;
    tool_name?: string;
    provider?: string;
    tenant_id?: string;
  }
): Promise<void> {
  const ttl = entry.ttl_hours || 24; // Default 24h
  const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000);
  
  const inputStr = JSON.stringify(entry.input_data);
  
  await supabase.from('intelligence_cache').insert({
    cache_key: entry.cache_key,
    cache_type: entry.cache_type,
    input_hash: entry.cache_key,
    input_preview: inputStr.substring(0, 500),
    output_data: entry.output_data,
    original_cost_usd: entry.original_cost_usd,
    expires_at: expiresAt.toISOString(),
    model: entry.model,
    tool_name: entry.tool_name,
    provider: entry.provider,
    tenant_id: entry.tenant_id,
  });
}

/**
 * Increment cache hit counter
 */
export async function recordCacheHit(
  supabase: ReturnType<typeof createClient>,
  cacheKey: string,
  costSaved: number
): Promise<void> {
  await supabase.rpc('increment_cache_hit', {
    p_cache_key: cacheKey,
    p_cost_saved: costSaved,
  });
}

// ============================================================================
// Agent Run Tracking
// ============================================================================

/**
 * Start a new agent run
 */
export async function startAgentRun(
  supabase: ReturnType<typeof createClient>,
  params: {
    agent_name: string;
    agent_version?: string;
    user_id?: string;
    tenant_id?: string;
    session_id?: string;
    purpose?: string;
    input_data?: any;
  }
): Promise<string> {
  const runId = `${params.agent_name}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  await supabase.from('agent_runs').insert({
    run_id: runId,
    agent_name: params.agent_name,
    agent_version: params.agent_version,
    user_id: params.user_id,
    tenant_id: params.tenant_id,
    session_id: params.session_id,
    purpose: params.purpose,
    input_data: params.input_data,
    status: 'running',
  });
  
  return runId;
}

/**
 * Update agent run with costs and metrics
 */
export async function updateAgentRunCosts(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  costs: {
    llm_cost_usd?: number;
    tool_cost_usd?: number;
    cache_savings_usd?: number;
    total_input_tokens?: number;
    total_output_tokens?: number;
    cache_hit_count?: number;
    cache_miss_count?: number;
    tool_call_count?: number;
    llm_call_count?: number;
  }
): Promise<void> {
  const totalCost = (costs.llm_cost_usd || 0) + (costs.tool_cost_usd || 0);
  const markupCost = totalCost * 1.30; // 30% markup
  const totalTokens = (costs.total_input_tokens || 0) + (costs.total_output_tokens || 0);

  await supabase.from('agent_runs').update({
    ...costs,
    total_tokens: totalTokens,
    total_cost_usd: totalCost,
    markup_cost_usd: markupCost,
  }).eq('run_id', runId);
}

/**
 * Complete an agent run
 */
export async function completeAgentRun(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  result: {
    status: AgentRunStatus;
    output_data?: any;
    error_message?: string;
  }
): Promise<void> {
  await supabase.rpc('complete_agent_run', {
    p_run_id: runId,
    p_status: result.status,
    p_output_data: result.output_data,
    p_error_message: result.error_message,
  });
}

// ============================================================================
// Tool Usage Tracking
// ============================================================================

/**
 * Record tool usage
 */
export async function recordToolUsage(
  supabase: ReturnType<typeof createClient>,
  agentRunId: string,
  usage: {
    tool_name: string;
    tool_provider: string;
    tool_operation?: string;
    input_data?: any;
    output_data?: any;
    units_consumed?: number;
    cost_usd: number;
    latency_ms?: number;
    cache_hit?: boolean;
  }
): Promise<void> {
  await supabase.from('tool_usage').insert({
    agent_run_id: agentRunId,
    tool_name: usage.tool_name,
    tool_provider: usage.tool_provider,
    tool_operation: usage.tool_operation,
    input_data: usage.input_data,
    output_data: usage.output_data,
    units_consumed: usage.units_consumed,
    cost_usd: usage.cost_usd,
    latency_ms: usage.latency_ms,
    cache_hit: usage.cache_hit || false,
  });
}

// ============================================================================
// Cost Calculation Helpers
// ============================================================================

/**
 * Tavily search cost (approximately $0.01 per search)
 */
export function calculateTavilyCost(searchCount: number): number {
  return searchCount * 0.01;
}

/**
 * Perplexity Sonar cost (approximately $0.005 per request)
 */
export function calculatePerplexityCost(requestCount: number): number {
  return requestCount * 0.005;
}

/**
 * Firecrawl cost (approximately $0.001 per page)
 */
export function calculateFirecrawlCost(pageCount: number): number {
  return pageCount * 0.001;
}

// ============================================================================
// Agent Run Context (for tracking within a run)
// ============================================================================

export class AgentRunContext {
  private supabase: ReturnType<typeof createClient>;
  private runId: string;
  private metrics = {
    llm_cost_usd: 0,
    tool_cost_usd: 0,
    cache_savings_usd: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    cache_hit_count: 0,
    cache_miss_count: 0,
    tool_call_count: 0,
    llm_call_count: 0,
  };

  constructor(supabase: ReturnType<typeof createClient>, runId: string) {
    this.supabase = supabase;
    this.runId = runId;
  }

  async recordLLMCall(inputTokens: number, outputTokens: number, cost: number, cacheHit: boolean = false) {
    this.metrics.llm_call_count++;
    this.metrics.total_input_tokens += inputTokens;
    this.metrics.total_output_tokens += outputTokens;

    if (cacheHit) {
      this.metrics.cache_hit_count++;
      this.metrics.cache_savings_usd += cost;
    } else {
      this.metrics.cache_miss_count++;
      this.metrics.llm_cost_usd += cost;
    }
  }

  async recordToolCall(toolName: string, provider: string, cost: number, cacheHit: boolean = false) {
    this.metrics.tool_call_count++;

    if (cacheHit) {
      this.metrics.cache_hit_count++;
      this.metrics.cache_savings_usd += cost;
    } else {
      this.metrics.cache_miss_count++;
      this.metrics.tool_cost_usd += cost;
    }
  }

  async flush() {
    await updateAgentRunCosts(this.supabase, this.runId, this.metrics);
  }

  async complete(status: AgentRunStatus, output?: any, error?: string) {
    await this.flush();
    await completeAgentRun(this.supabase, this.runId, {
      status,
      output_data: output,
      error_message: error,
    });
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

