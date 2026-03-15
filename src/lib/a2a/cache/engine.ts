/**
 * A2A Task Result Cache Engine
 *
 * Content-addressed caching and in-flight deduplication for the A2A task
 * protocol. Eliminates redundant execution when multiple agents submit
 * semantically identical tasks.
 *
 * Architecture:
 * - Cache keys are SHA-256 hashes of `intent:canonicalized_input`
 * - Cache entries are stored in Supabase with TTL and stale-while-revalidate
 * - In-flight deduplication tracks "leader" tasks; followers wait for the leader
 * - Per-intent cache policies control TTL, max size, and field exclusions
 * - Statistics are tracked for cost optimization and observability
 */

import type {
  CacheKey,
  CacheEntry,
  CacheEntryStatus,
  CachePolicy,
  CacheStats,
  IntentCacheStats,
  CoalescedRequest,
} from './types';

// ──────────────────────────────────────────────
// Cache Key Computation
// ──────────────────────────────────────────────

/**
 * Compute a deterministic cache key from intent + input.
 * The input is canonicalized (sorted keys, no whitespace) before hashing
 * so that `{a:1, b:2}` and `{b:2, a:1}` produce the same key.
 *
 * Optional `ignoredFields` strips personalization fields (e.g., agent_id)
 * that shouldn't affect cache identity.
 */
export async function computeCacheKey(
  intent: string,
  input: Record<string, unknown>,
  ignoredFields: string[] = [],
): Promise<CacheKey> {
  const filtered = filterFields(input, ignoredFields);
  const canonical = canonicalize(filtered);
  const raw = `${intent}:${canonical}`;
  const hash = await sha256Hex(raw);
  return { hash, intent, canonical_input: canonical };
}

/** Recursively sort object keys for deterministic serialization. */
function canonicalize(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sorted.map(
    (k) => `${JSON.stringify(k)}:${canonicalize((obj as Record<string, unknown>)[k])}`,
  );
  return '{' + pairs.join(',') + '}';
}

/** Remove ignored fields from input (shallow — top-level only). */
function filterFields(
  input: Record<string, unknown>,
  ignoredFields: string[],
): Record<string, unknown> {
  if (ignoredFields.length === 0) return input;
  const ignored = new Set(ignoredFields);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (!ignored.has(k)) result[k] = v;
  }
  return result;
}

/** SHA-256 hex digest using Web Crypto API (available in Node 18+ and Edge Runtime). */
async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ──────────────────────────────────────────────
// Cache Policy Resolution
// ──────────────────────────────────────────────

/** Default cache policy for intents without explicit configuration. */
const DEFAULT_POLICY: Omit<CachePolicy, 'id' | 'intent_pattern' | 'created_at' | 'updated_at'> = {
  enabled: true,
  default_ttl_seconds: 300, // 5 minutes
  max_ttl_seconds: 3600,    // 1 hour
  stale_while_revalidate_seconds: 60,
  max_result_size_bytes: 1_048_576, // 1MB
  ignored_input_fields: [],
};

/**
 * Find the best-matching cache policy for an intent.
 * Matches exact patterns first, then glob patterns (e.g., "news.*").
 */
export async function resolveCachePolicy(
  intent: string,
): Promise<CachePolicy | null> {
  const { getServiceDb } = await import('../auth');
  const db = getServiceDb();
  if (!db) return null;

  const { data: policies } = await db
    .from('a2a_cache_policies')
    .select('*')
    .order('intent_pattern', { ascending: true });

  if (!policies || policies.length === 0) return null;

  // Exact match first
  const exact = policies.find((p: CachePolicy) => p.intent_pattern === intent);
  if (exact) return exact;

  // Glob match (e.g., "news.*" matches "news.query")
  for (const policy of policies) {
    if (matchGlob(policy.intent_pattern, intent)) {
      return policy;
    }
  }

  return null;
}

/** Simple glob matching: supports trailing `*` and `.*` patterns. */
function matchGlob(pattern: string, value: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return value === prefix || value.startsWith(prefix + '.');
  }
  if (pattern.endsWith('*')) {
    return value.startsWith(pattern.slice(0, -1));
  }
  return pattern === value;
}

/**
 * Get effective cache parameters for an intent, merging policy with defaults.
 */
export async function getEffectiveCacheParams(intent: string): Promise<{
  enabled: boolean;
  ttl_seconds: number;
  stale_while_revalidate_seconds: number;
  max_result_size_bytes: number;
  ignored_input_fields: string[];
}> {
  const policy = await resolveCachePolicy(intent);
  return {
    enabled: policy?.enabled ?? DEFAULT_POLICY.enabled,
    ttl_seconds: policy?.default_ttl_seconds ?? DEFAULT_POLICY.default_ttl_seconds,
    stale_while_revalidate_seconds:
      policy?.stale_while_revalidate_seconds ?? DEFAULT_POLICY.stale_while_revalidate_seconds,
    max_result_size_bytes: policy?.max_result_size_bytes ?? DEFAULT_POLICY.max_result_size_bytes,
    ignored_input_fields: policy?.ignored_input_fields ?? DEFAULT_POLICY.ignored_input_fields,
  };
}

// ──────────────────────────────────────────────
// Cache Lookup
// ──────────────────────────────────────────────

export interface CacheLookupResult {
  hit: boolean;
  status: CacheEntryStatus | 'miss';
  entry: CacheEntry | null;
  cache_key: string;
}

/**
 * Look up a cached result by intent + input.
 * Returns the cached entry if fresh or stale (with status indicator).
 * Increments hit_count on cache hits.
 */
export async function lookupCache(
  intent: string,
  input: Record<string, unknown>,
): Promise<CacheLookupResult> {
  const params = await getEffectiveCacheParams(intent);
  const cacheKey = await computeCacheKey(intent, input, params.ignored_input_fields);

  if (!params.enabled) {
    return { hit: false, status: 'miss', entry: null, cache_key: cacheKey.hash };
  }

  const { getServiceDb } = await import('../auth');
  const db = getServiceDb();
  if (!db) {
    return { hit: false, status: 'miss', entry: null, cache_key: cacheKey.hash };
  }

  const now = new Date().toISOString();

  // Look for a non-expired entry
  const { data: entry } = await db
    .from('a2a_result_cache')
    .select('*')
    .eq('cache_key', cacheKey.hash)
    .gt('stale_deadline', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!entry) {
    // Record cache miss for stats
    await recordCacheStat(db, intent, 'miss');
    return { hit: false, status: 'miss', entry: null, cache_key: cacheKey.hash };
  }

  // Determine freshness
  const expiresAt = new Date(entry.expires_at);
  const isFresh = new Date(now) < expiresAt;
  const status: CacheEntryStatus = isFresh ? 'fresh' : 'stale';

  // Increment hit count and last_served_at (fire-and-forget)
  db.from('a2a_result_cache')
    .update({ hit_count: entry.hit_count + 1, last_served_at: now })
    .eq('id', entry.id)
    .then(() => {});

  // Record cache hit for stats
  await recordCacheStat(db, intent, isFresh ? 'hit_fresh' : 'hit_stale');

  return { hit: true, status, entry, cache_key: cacheKey.hash };
}

// ──────────────────────────────────────────────
// Cache Storage
// ──────────────────────────────────────────────

export interface CacheStoreParams {
  intent: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  source_task_id: string;
  producer_agent_id: string;
  /** Override default TTL (capped by policy max). */
  ttl_seconds?: number;
}

/**
 * Store a task result in the cache.
 * Respects cache policy (enabled, max size, TTL caps).
 * Uses upsert so re-execution naturally refreshes stale entries.
 */
export async function storeInCache(params: CacheStoreParams): Promise<CacheEntry | null> {
  const cacheParams = await getEffectiveCacheParams(params.intent);
  if (!cacheParams.enabled) return null;

  // Check result size
  const resultJson = JSON.stringify(params.result);
  const resultSizeBytes = new TextEncoder().encode(resultJson).byteLength;
  if (resultSizeBytes > cacheParams.max_result_size_bytes) return null;

  const cacheKey = await computeCacheKey(
    params.intent,
    params.input,
    cacheParams.ignored_input_fields,
  );

  // Cap TTL
  const ttl = Math.min(
    params.ttl_seconds ?? cacheParams.ttl_seconds,
    cacheParams.ttl_seconds,
  );
  const swr = cacheParams.stale_while_revalidate_seconds;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl * 1000);
  const staleDeadline = new Date(expiresAt.getTime() + swr * 1000);

  const { getServiceDb } = await import('../auth');
  const db = getServiceDb();
  if (!db) return null;

  const row = {
    cache_key: cacheKey.hash,
    intent: params.intent,
    input: params.input,
    result: params.result,
    source_task_id: params.source_task_id,
    producer_agent_id: params.producer_agent_id,
    hit_count: 0,
    result_size_bytes: resultSizeBytes,
    ttl_seconds: ttl,
    stale_while_revalidate_seconds: swr,
    expires_at: expiresAt.toISOString(),
    stale_deadline: staleDeadline.toISOString(),
  };

  // Upsert by cache_key — refreshes existing entries
  const { data, error } = await db
    .from('a2a_result_cache')
    .upsert(row, { onConflict: 'cache_key' })
    .select('*')
    .single();

  if (error || !data) return null;

  // Resolve any coalesced (waiting) requests for this cache key
  await resolveCoalescedRequests(cacheKey.hash, params.source_task_id);

  return data;
}

// ──────────────────────────────────────────────
// In-Flight Deduplication
// ──────────────────────────────────────────────

/**
 * Check if there's already a task in-flight for this cache key.
 * If so, register the current task as a follower (coalesced request).
 * Returns the leader task ID if coalesced, null if this is a new request.
 */
export async function checkInFlight(
  cacheKey: string,
  followerTaskId: string,
  followerAgentId: string,
): Promise<string | null> {
  const { getServiceDb } = await import('../auth');
  const db = getServiceDb();
  if (!db) return null;

  // Find an active (non-completed) task with this cache key
  const { data: leader } = await db
    .from('a2a_tasks')
    .select('id')
    .eq('cache_key', cacheKey)
    .in('status', ['accepted', 'in_progress'])
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (!leader) return null;

  // Register as a coalesced request
  await db.from('a2a_coalesced_requests').insert({
    cache_key: cacheKey,
    leader_task_id: leader.id,
    follower_task_id: followerTaskId,
    follower_agent_id: followerAgentId,
    status: 'waiting',
  });

  // Record coalescence stat
  await recordCacheStat(db, '', 'coalesced');

  return leader.id;
}

/**
 * When a leader task completes, resolve all followers by copying
 * the result to their task records and marking them completed.
 */
async function resolveCoalescedRequests(
  cacheKey: string,
  leaderTaskId: string,
): Promise<void> {
  const { getServiceDb } = await import('../auth');
  const db = getServiceDb();
  if (!db) return;

  // Get leader's result
  const { data: leader } = await db
    .from('a2a_tasks')
    .select('result, status')
    .eq('id', leaderTaskId)
    .single();

  if (!leader || leader.status !== 'completed') return;

  // Find waiting followers
  const { data: followers } = await db
    .from('a2a_coalesced_requests')
    .select('follower_task_id')
    .eq('cache_key', cacheKey)
    .eq('leader_task_id', leaderTaskId)
    .eq('status', 'waiting');

  if (!followers || followers.length === 0) return;

  const now = new Date().toISOString();
  const followerIds = followers.map((f: CoalescedRequest) => f.follower_task_id);

  // Update all follower tasks with the leader's result
  await db
    .from('a2a_tasks')
    .update({
      status: 'completed',
      result: leader.result,
      completed_at: now,
    })
    .in('id', followerIds);

  // Mark coalesced requests as resolved
  await db
    .from('a2a_coalesced_requests')
    .update({ status: 'resolved', resolved_at: now })
    .eq('cache_key', cacheKey)
    .eq('leader_task_id', leaderTaskId)
    .eq('status', 'waiting');
}

// ──────────────────────────────────────────────
// Cache Invalidation
// ──────────────────────────────────────────────

export interface InvalidationResult {
  invalidated_count: number;
  cache_keys: string[];
}

/**
 * Invalidate cache entries by key, intent pattern, or producer.
 * Invalidated entries are deleted (not just marked expired) to
 * ensure clean cache state.
 */
export async function invalidateCache(params: {
  cache_key?: string;
  intent_pattern?: string;
  producer_agent_id?: string;
  reason: string;
  invalidated_by: string;
}): Promise<InvalidationResult> {
  const { getServiceDb } = await import('../auth');
  const db = getServiceDb();
  if (!db) return { invalidated_count: 0, cache_keys: [] };

  // First, find entries to invalidate
  let query = db.from('a2a_result_cache').select('id, cache_key');

  if (params.cache_key) {
    query = query.eq('cache_key', params.cache_key);
  }
  if (params.intent_pattern) {
    if (params.intent_pattern.includes('*')) {
      // Glob pattern — convert to SQL LIKE
      const likePattern = params.intent_pattern.replace(/\*/g, '%');
      query = query.like('intent', likePattern);
    } else {
      query = query.eq('intent', params.intent_pattern);
    }
  }
  if (params.producer_agent_id) {
    query = query.eq('producer_agent_id', params.producer_agent_id);
  }

  const { data: entries } = await query;
  if (!entries || entries.length === 0) {
    return { invalidated_count: 0, cache_keys: [] };
  }

  const ids = entries.map((e: { id: string }) => e.id);
  const cacheKeys = entries.map((e: { cache_key: string }) => e.cache_key);

  // Delete the entries
  await db.from('a2a_result_cache').delete().in('id', ids);

  // Audit log
  await db.from('a2a_cache_invalidations').insert({
    cache_keys: cacheKeys,
    intent_pattern: params.intent_pattern ?? null,
    producer_agent_id: params.producer_agent_id ?? null,
    reason: params.reason,
    invalidated_by: params.invalidated_by,
    invalidated_count: ids.length,
  });

  return { invalidated_count: ids.length, cache_keys: cacheKeys };
}

// ──────────────────────────────────────────────
// Cache Policy Management
// ──────────────────────────────────────────────

/**
 * Create or update a cache policy for an intent pattern.
 * Uses upsert by intent_pattern for idempotency.
 */
export async function upsertCachePolicy(params: {
  intent_pattern: string;
  enabled?: boolean;
  default_ttl_seconds?: number;
  max_ttl_seconds?: number;
  stale_while_revalidate_seconds?: number;
  max_result_size_bytes?: number;
  ignored_input_fields?: string[];
}): Promise<CachePolicy | null> {
  const { getServiceDb } = await import('../auth');
  const db = getServiceDb();
  if (!db) return null;

  const row = {
    intent_pattern: params.intent_pattern,
    enabled: params.enabled ?? DEFAULT_POLICY.enabled,
    default_ttl_seconds: params.default_ttl_seconds ?? DEFAULT_POLICY.default_ttl_seconds,
    max_ttl_seconds: params.max_ttl_seconds ?? DEFAULT_POLICY.max_ttl_seconds,
    stale_while_revalidate_seconds:
      params.stale_while_revalidate_seconds ?? DEFAULT_POLICY.stale_while_revalidate_seconds,
    max_result_size_bytes: params.max_result_size_bytes ?? DEFAULT_POLICY.max_result_size_bytes,
    ignored_input_fields: params.ignored_input_fields ?? DEFAULT_POLICY.ignored_input_fields,
  };

  const { data, error } = await db
    .from('a2a_cache_policies')
    .upsert(row, { onConflict: 'intent_pattern' })
    .select('*')
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Delete a cache policy by intent pattern.
 */
export async function deleteCachePolicy(intentPattern: string): Promise<boolean> {
  const { getServiceDb } = await import('../auth');
  const db = getServiceDb();
  if (!db) return false;

  const { error } = await db
    .from('a2a_cache_policies')
    .delete()
    .eq('intent_pattern', intentPattern);

  return !error;
}

/**
 * List all cache policies.
 */
export async function listCachePolicies(): Promise<CachePolicy[]> {
  const { getServiceDb } = await import('../auth');
  const db = getServiceDb();
  if (!db) return [];

  const { data } = await db
    .from('a2a_cache_policies')
    .select('*')
    .order('intent_pattern', { ascending: true });

  return data ?? [];
}

// ──────────────────────────────────────────────
// Cache Statistics
// ──────────────────────────────────────────────

type StatEvent = 'miss' | 'hit_fresh' | 'hit_stale' | 'coalesced';

/** Record a cache stat event (fire-and-forget). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recordCacheStat(db: any, intent: string, event: StatEvent): Promise<void> {
  try {
    await db.from('a2a_cache_stats').insert({
      intent: intent || '_system',
      event,
    });
  } catch {
    // Stats are best-effort — never fail the main request
  }
}

/**
 * Get aggregated cache statistics for a time window.
 */
export async function getCacheStats(
  windowHours: number = 24,
): Promise<CacheStats> {
  const { getServiceDb } = await import('../auth');
  const db = getServiceDb();

  const windowStart = new Date(Date.now() - windowHours * 3600_000).toISOString();
  const windowEnd = new Date().toISOString();

  const empty: CacheStats = {
    total_lookups: 0,
    hits_fresh: 0,
    hits_stale: 0,
    misses: 0,
    coalesced: 0,
    hit_rate: 0,
    estimated_savings_credits: 0,
    active_entries: 0,
    total_cached_bytes: 0,
    window_start: windowStart,
    window_end: windowEnd,
  };

  if (!db) return empty;

  // Count stat events in window
  const { data: stats } = await db
    .from('a2a_cache_stats')
    .select('event')
    .gte('created_at', windowStart);

  if (!stats) return empty;

  let hitsFresh = 0;
  let hitsStale = 0;
  let misses = 0;
  let coalesced = 0;

  for (const row of stats) {
    switch (row.event) {
      case 'hit_fresh': hitsFresh++; break;
      case 'hit_stale': hitsStale++; break;
      case 'miss': misses++; break;
      case 'coalesced': coalesced++; break;
    }
  }

  const totalLookups = hitsFresh + hitsStale + misses;
  const totalHits = hitsFresh + hitsStale;

  // Active entries count
  const { count: activeEntries } = await db
    .from('a2a_result_cache')
    .select('id', { count: 'exact', head: true })
    .gt('stale_deadline', windowEnd);

  // Total cached bytes
  const { data: sizeData } = await db
    .from('a2a_result_cache')
    .select('result_size_bytes')
    .gt('stale_deadline', windowEnd);

  const totalCachedBytes = (sizeData ?? []).reduce(
    (sum: number, r: { result_size_bytes: number }) => sum + r.result_size_bytes,
    0,
  );

  // Estimated savings: each hit saves ~1 credit (average task execution cost)
  const estimatedSavings = totalHits + coalesced;

  return {
    total_lookups: totalLookups,
    hits_fresh: hitsFresh,
    hits_stale: hitsStale,
    misses,
    coalesced,
    hit_rate: totalLookups > 0 ? Math.round((totalHits / totalLookups) * 1000) / 1000 : 0,
    estimated_savings_credits: estimatedSavings,
    active_entries: activeEntries ?? 0,
    total_cached_bytes: totalCachedBytes,
    window_start: windowStart,
    window_end: windowEnd,
  };
}

/**
 * Get per-intent cache statistics breakdown.
 */
export async function getIntentCacheStats(
  windowHours: number = 24,
): Promise<IntentCacheStats[]> {
  const { getServiceDb } = await import('../auth');
  const db = getServiceDb();
  if (!db) return [];

  const windowStart = new Date(Date.now() - windowHours * 3600_000).toISOString();

  const { data: stats } = await db
    .from('a2a_cache_stats')
    .select('intent, event')
    .gte('created_at', windowStart)
    .neq('intent', '_system');

  if (!stats || stats.length === 0) return [];

  // Aggregate by intent
  const byIntent = new Map<string, { lookups: number; hits: number; misses: number; coalesced: number }>();

  for (const row of stats) {
    const current = byIntent.get(row.intent) ?? { lookups: 0, hits: 0, misses: 0, coalesced: 0 };
    if (row.event === 'hit_fresh' || row.event === 'hit_stale') {
      current.hits++;
      current.lookups++;
    } else if (row.event === 'miss') {
      current.misses++;
      current.lookups++;
    } else if (row.event === 'coalesced') {
      current.coalesced++;
    }
    byIntent.set(row.intent, current);
  }

  // Get average result sizes and TTLs from cache entries
  const { data: entries } = await db
    .from('a2a_result_cache')
    .select('intent, result_size_bytes, ttl_seconds');

  const sizeTtlByIntent = new Map<string, { sizes: number[]; ttls: number[] }>();
  for (const e of entries ?? []) {
    const current = sizeTtlByIntent.get(e.intent) ?? { sizes: [], ttls: [] };
    current.sizes.push(e.result_size_bytes);
    current.ttls.push(e.ttl_seconds);
    sizeTtlByIntent.set(e.intent, current);
  }

  const result: IntentCacheStats[] = [];
  for (const [intent, counts] of byIntent) {
    const meta = sizeTtlByIntent.get(intent);
    const avgSize = meta && meta.sizes.length > 0
      ? Math.round(meta.sizes.reduce((a, b) => a + b, 0) / meta.sizes.length)
      : 0;
    const avgTtl = meta && meta.ttls.length > 0
      ? Math.round(meta.ttls.reduce((a, b) => a + b, 0) / meta.ttls.length)
      : 0;

    result.push({
      intent,
      lookups: counts.lookups,
      hits: counts.hits,
      misses: counts.misses,
      coalesced: counts.coalesced,
      hit_rate: counts.lookups > 0
        ? Math.round((counts.hits / counts.lookups) * 1000) / 1000
        : 0,
      avg_result_size_bytes: avgSize,
      avg_ttl_seconds: avgTtl,
    });
  }

  return result.sort((a, b) => b.lookups - a.lookups);
}

/**
 * Cleanup expired cache entries and old stat records.
 * Should be called periodically (e.g., via cron or on-demand).
 */
export async function cleanupExpiredEntries(): Promise<{ deleted_entries: number; deleted_stats: number }> {
  const { getServiceDb } = await import('../auth');
  const db = getServiceDb();
  if (!db) return { deleted_entries: 0, deleted_stats: 0 };

  const now = new Date().toISOString();
  const statsRetention = new Date(Date.now() - 7 * 24 * 3600_000).toISOString(); // 7 days

  // Delete expired cache entries
  const { count: deletedEntries } = await db
    .from('a2a_result_cache')
    .delete({ count: 'exact' })
    .lt('stale_deadline', now);

  // Delete old stat records
  const { count: deletedStats } = await db
    .from('a2a_cache_stats')
    .delete({ count: 'exact' })
    .lt('created_at', statsRetention);

  // Delete old resolved coalesced requests
  const { count: _deletedCoalesced } = await db
    .from('a2a_coalesced_requests')
    .delete({ count: 'exact' })
    .in('status', ['resolved', 'failed'])
    .lt('created_at', statsRetention);

  return {
    deleted_entries: deletedEntries ?? 0,
    deleted_stats: (deletedStats ?? 0),
  };
}
