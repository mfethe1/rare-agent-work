/**
 * Zod validation schemas for A2A Cache API endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

// ──────────────────────────────────────────────
// Cache Lookup — POST /api/a2a/cache/lookup
// ──────────────────────────────────────────────

export const cacheLookupSchema = z.object({
  /** The task intent to look up. */
  intent: trimmed(128).min(1, 'Intent is required'),
  /** The task input to match against. */
  input: z.record(z.string(), z.unknown()).default({}),
});

export type CacheLookupInput = z.infer<typeof cacheLookupSchema>;

// ──────────────────────────────────────────────
// Cache Invalidation — POST /api/a2a/cache/invalidate
// ──────────────────────────────────────────────

export const cacheInvalidateSchema = z.object({
  /** Invalidate by specific cache key hash. */
  cache_key: trimmed(128).optional(),
  /** Invalidate all entries for an intent (supports glob like "news.*"). */
  intent_pattern: trimmed(128).optional(),
  /** Invalidate entries produced by a specific agent. */
  producer_agent_id: z.string().uuid().optional(),
  /** Reason for invalidation (for audit trail). */
  reason: trimmed(500).min(1, 'Invalidation reason is required'),
}).refine(
  (data) => data.cache_key || data.intent_pattern || data.producer_agent_id,
  { message: 'At least one of cache_key, intent_pattern, or producer_agent_id is required.' },
);

export type CacheInvalidateInput = z.infer<typeof cacheInvalidateSchema>;

// ──────────────────────────────────────────────
// Cache Policy — POST /api/a2a/cache/policies
// ──────────────────────────────────────────────

export const cachePolicySchema = z.object({
  /** Intent pattern this policy applies to (supports glob like "news.*"). */
  intent_pattern: trimmed(128).min(1, 'Intent pattern is required'),
  /** Whether caching is enabled. */
  enabled: z.boolean().default(true),
  /** Default TTL in seconds (1 minute to 24 hours). */
  default_ttl_seconds: z.number().int().min(60).max(86400).default(300),
  /** Maximum TTL in seconds (caps per-request overrides). */
  max_ttl_seconds: z.number().int().min(60).max(86400).default(3600),
  /** Stale-while-revalidate grace period in seconds. */
  stale_while_revalidate_seconds: z.number().int().min(0).max(3600).default(60),
  /** Maximum result size to cache in bytes (up to 10MB). */
  max_result_size_bytes: z.number().int().min(1024).max(10_485_760).default(1_048_576),
  /** Input fields to exclude from the cache key. */
  ignored_input_fields: z.array(trimmed(128)).max(20).default([]),
});

export type CachePolicyInput = z.infer<typeof cachePolicySchema>;

// ──────────────────────────────────────────────
// Cache Policy Delete — DELETE /api/a2a/cache/policies
// ──────────────────────────────────────────────

export const cachePolicyDeleteSchema = z.object({
  /** Intent pattern of the policy to delete. */
  intent_pattern: trimmed(128).min(1, 'Intent pattern is required'),
});

export type CachePolicyDeleteInput = z.infer<typeof cachePolicyDeleteSchema>;

// ──────────────────────────────────────────────
// Cache Stats — GET /api/a2a/cache
// ──────────────────────────────────────────────

export const cacheStatsSchema = z.object({
  /** Time window in hours (1-168, default 24). */
  window_hours: z.number().int().min(1).max(168).default(24),
});

export type CacheStatsInput = z.infer<typeof cacheStatsSchema>;

// ──────────────────────────────────────────────
// Cache Warm — POST /api/a2a/cache/warm
// ──────────────────────────────────────────────

export const cacheWarmSchema = z.object({
  /** The task intent to warm. */
  intent: trimmed(128).min(1, 'Intent is required'),
  /** The task input. */
  input: z.record(z.string(), z.unknown()).default({}),
  /** Force re-execution even if cached. */
  force: z.boolean().default(false),
});

export type CacheWarmInput = z.infer<typeof cacheWarmSchema>;
