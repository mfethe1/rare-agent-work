/**
 * A2A Task Result Cache & Deduplication Types
 *
 * In a 2028 agent economy, redundant execution of identical tasks is the
 * single largest source of wasted compute and cost. When 50 agents all
 * need "summarize today's security news", that should execute once.
 *
 * This subsystem provides:
 * - Content-addressed caching keyed by intent + canonical input hash
 * - TTL-aware cache entries with staleness windows
 * - In-flight deduplication (coalescing concurrent identical requests)
 * - Per-intent cache policies (some intents are cacheable, some aren't)
 * - Cache statistics for cost optimization and observability
 */

// ──────────────────────────────────────────────
// Cache Key
// ──────────────────────────────────────────────

/**
 * A content-addressed cache key derived from intent + canonical input.
 * Two tasks with the same intent and semantically identical input
 * produce the same cache key, regardless of field ordering or whitespace.
 */
export interface CacheKey {
  /** SHA-256 hex digest of `intent + ":" + canonicalized(input)`. */
  hash: string;
  /** The intent that was hashed. */
  intent: string;
  /** The canonical JSON input that was hashed (for debugging). */
  canonical_input: string;
}

// ──────────────────────────────────────────────
// Cache Entry
// ──────────────────────────────────────────────

export type CacheEntryStatus = 'fresh' | 'stale' | 'expired';

/** A cached task result stored in the platform. */
export interface CacheEntry {
  /** Platform-assigned cache entry ID (UUID). */
  id: string;
  /** Content-addressed hash (the cache key). */
  cache_key: string;
  /** The task intent this entry caches. */
  intent: string;
  /** The canonical input that produced this result. */
  input: Record<string, unknown>;
  /** The cached result payload. */
  result: Record<string, unknown>;
  /** ID of the original task that produced this result. */
  source_task_id: string;
  /** ID of the agent that produced the original result. */
  producer_agent_id: string;
  /** Number of times this entry has been served from cache. */
  hit_count: number;
  /** Size of the result payload in bytes. */
  result_size_bytes: number;
  /** Freshness TTL in seconds (entry is "fresh" within this window). */
  ttl_seconds: number;
  /** Staleness grace period in seconds (entry is "stale" but servable within this window after TTL). */
  stale_while_revalidate_seconds: number;
  /** When the entry was created. */
  created_at: string;
  /** When the entry expires (created_at + ttl_seconds). */
  expires_at: string;
  /** When the entry becomes completely unservable (expires_at + stale_while_revalidate_seconds). */
  stale_deadline: string;
  /** Last time this entry was served from cache. */
  last_served_at: string | null;
}

// ──────────────────────────────────────────────
// In-Flight Deduplication
// ──────────────────────────────────────────────

export type CoalescedRequestStatus = 'waiting' | 'resolved' | 'failed';

/**
 * When multiple agents submit identical tasks concurrently, only the first
 * executes. Subsequent requests are "coalesced" — they wait for the first
 * result rather than re-executing.
 */
export interface CoalescedRequest {
  /** Platform-assigned ID. */
  id: string;
  /** The cache key being waited on. */
  cache_key: string;
  /** The task ID that is actually executing (the "leader"). */
  leader_task_id: string;
  /** The task ID that is waiting (the "follower"). */
  follower_task_id: string;
  /** Agent ID of the follower. */
  follower_agent_id: string;
  /** Current status. */
  status: CoalescedRequestStatus;
  /** When the follower started waiting. */
  created_at: string;
  /** When the follower was resolved (got the cached result). */
  resolved_at: string | null;
}

// ──────────────────────────────────────────────
// Cache Policy
// ──────────────────────────────────────────────

/**
 * Per-intent cache policy. Controls whether and how results for
 * a given intent are cached. Agents or platform admins can configure these.
 */
export interface CachePolicy {
  /** Platform-assigned policy ID (UUID). */
  id: string;
  /** The intent this policy applies to (supports glob patterns like "news.*"). */
  intent_pattern: string;
  /** Whether caching is enabled for matching intents. */
  enabled: boolean;
  /** Default TTL in seconds for cached results. */
  default_ttl_seconds: number;
  /** Maximum TTL in seconds (caps per-request overrides). */
  max_ttl_seconds: number;
  /** Stale-while-revalidate grace period in seconds. */
  stale_while_revalidate_seconds: number;
  /** Maximum result size to cache (in bytes). Larger results are not cached. */
  max_result_size_bytes: number;
  /** Input fields to exclude from the cache key (for personalization fields). */
  ignored_input_fields: string[];
  /** When this policy was created. */
  created_at: string;
  /** When this policy was last updated. */
  updated_at: string;
}

// ──────────────────────────────────────────────
// Cache Statistics
// ──────────────────────────────────────────────

/** Aggregated cache statistics for observability and cost optimization. */
export interface CacheStats {
  /** Total cache lookups. */
  total_lookups: number;
  /** Cache hits (fresh). */
  hits_fresh: number;
  /** Cache hits (stale, served while revalidating). */
  hits_stale: number;
  /** Cache misses. */
  misses: number;
  /** Requests coalesced (deduplicated in-flight). */
  coalesced: number;
  /** Hit rate (0-1). */
  hit_rate: number;
  /** Estimated cost savings (based on average task execution cost). */
  estimated_savings_credits: number;
  /** Total entries currently in cache. */
  active_entries: number;
  /** Total result payload bytes in cache. */
  total_cached_bytes: number;
  /** Statistics window start. */
  window_start: string;
  /** Statistics window end. */
  window_end: string;
}

/** Per-intent cache statistics breakdown. */
export interface IntentCacheStats {
  intent: string;
  lookups: number;
  hits: number;
  misses: number;
  coalesced: number;
  hit_rate: number;
  avg_result_size_bytes: number;
  avg_ttl_seconds: number;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** GET /api/a2a/cache — cache statistics. */
export interface CacheStatsResponse {
  stats: CacheStats;
  by_intent: IntentCacheStats[];
  policies: CachePolicy[];
}

/** POST /api/a2a/cache/lookup — explicit cache lookup. */
export interface CacheLookupRequest {
  intent: string;
  input: Record<string, unknown>;
}

export interface CacheLookupResponse {
  hit: boolean;
  status: CacheEntryStatus | 'miss';
  entry: CacheEntry | null;
  cache_key: string;
}

/** POST /api/a2a/cache/invalidate — invalidate cache entries. */
export interface CacheInvalidateRequest {
  /** Invalidate by specific cache key hash. */
  cache_key?: string;
  /** Invalidate all entries for an intent (supports glob). */
  intent_pattern?: string;
  /** Invalidate entries produced by a specific agent. */
  producer_agent_id?: string;
  /** Reason for invalidation (for audit). */
  reason: string;
}

export interface CacheInvalidateResponse {
  invalidated_count: number;
  cache_keys: string[];
}

/** POST /api/a2a/cache/policies — create or update a cache policy. */
export interface CachePolicyRequest {
  intent_pattern: string;
  enabled?: boolean;
  default_ttl_seconds?: number;
  max_ttl_seconds?: number;
  stale_while_revalidate_seconds?: number;
  max_result_size_bytes?: number;
  ignored_input_fields?: string[];
}

export interface CachePolicyResponse {
  policy: CachePolicy;
}

/** DELETE /api/a2a/cache/policies — remove a cache policy. */
export interface CachePolicyDeleteResponse {
  deleted: boolean;
  intent_pattern: string;
}

/** POST /api/a2a/cache/warm — pre-populate cache for an intent. */
export interface CacheWarmRequest {
  intent: string;
  input: Record<string, unknown>;
  /** Force re-execution even if cached. */
  force?: boolean;
}

export interface CacheWarmResponse {
  task_id: string;
  cache_key: string;
  was_cached: boolean;
  status: 'executed' | 'already_cached';
}
