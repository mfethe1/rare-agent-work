/**
 * In-memory token bucket rate limiter.
 * Round 27
 */

export type RateLimitTier = "anonymous" | "authenticated" | "premium";

interface Bucket {
  tokens: number;
  last_refill: number; // epoch ms
  endpoint_usage: Map<string, number>;
}

const LIMITS: Record<RateLimitTier, number> = {
  anonymous: 60,
  authenticated: 600,
  premium: 3000,
};

// Refill interval = 1 hour in ms
const REFILL_INTERVAL_MS = 60 * 60 * 1000;

// In-memory store: key → bucket
const buckets = new Map<string, Bucket>();

function getBucketKey(agentId: string | null): string {
  return agentId ?? "anon";
}

function getOrCreateBucket(key: string, tier: RateLimitTier): Bucket {
  const existing = buckets.get(key);
  const limit = LIMITS[tier];
  const now = Date.now();

  if (!existing) {
    const bucket: Bucket = {
      tokens: limit,
      last_refill: now,
      endpoint_usage: new Map(),
    };
    buckets.set(key, bucket);
    return bucket;
  }

  // Refill if an hour has passed
  const elapsed = now - existing.last_refill;
  if (elapsed >= REFILL_INTERVAL_MS) {
    existing.tokens = limit;
    existing.last_refill = now;
    existing.endpoint_usage.clear();
  }

  return existing;
}

export interface RateLimitResult {
  allowed: boolean;
  tier: RateLimitTier;
  limit: number;
  remaining: number;
  reset_at: string; // ISO timestamp
  retry_after?: number; // seconds until reset
}

/**
 * Check (and consume) a token for the given agent+endpoint.
 * @param agentId null = anonymous
 * @param tier    the agent's tier
 * @param endpoint optional endpoint label for per-endpoint tracking
 */
export function checkRateLimit(
  agentId: string | null,
  tier: RateLimitTier,
  endpoint = "global",
): RateLimitResult {
  const key = getBucketKey(agentId);
  const limit = LIMITS[tier];
  const bucket = getOrCreateBucket(key, tier);

  const now = Date.now();
  const reset_at = new Date(bucket.last_refill + REFILL_INTERVAL_MS).toISOString();

  if (bucket.tokens <= 0) {
    const retry_after = Math.ceil((bucket.last_refill + REFILL_INTERVAL_MS - now) / 1000);
    return { allowed: false, tier, limit, remaining: 0, reset_at, retry_after };
  }

  bucket.tokens -= 1;
  bucket.endpoint_usage.set(endpoint, (bucket.endpoint_usage.get(endpoint) ?? 0) + 1);

  return {
    allowed: true,
    tier,
    limit,
    remaining: bucket.tokens,
    reset_at,
  };
}

/**
 * Get status without consuming a token.
 */
export function getRateLimitStatus(
  agentId: string | null,
  tier: RateLimitTier,
): {
  tier: RateLimitTier;
  limit: number;
  remaining: number;
  reset_at: string;
  per_endpoint: Array<{ endpoint: string; used: number; limit: number }>;
} {
  const key = getBucketKey(agentId);
  const limit = LIMITS[tier];
  const bucket = getOrCreateBucket(key, tier);
  const reset_at = new Date(bucket.last_refill + REFILL_INTERVAL_MS).toISOString();

  const per_endpoint: Array<{ endpoint: string; used: number; limit: number }> = [];
  for (const [ep, used] of bucket.endpoint_usage.entries()) {
    per_endpoint.push({ endpoint: ep, used, limit });
  }

  return {
    tier,
    limit,
    remaining: bucket.tokens,
    reset_at,
    per_endpoint,
  };
}

/**
 * Determine tier from agent record (basic heuristic based on reputation).
 * Agents with premium capability or high reputation get premium tier.
 */
export function getTierForAgent(agent: { capabilities?: string[]; trust_tier?: string } | null): RateLimitTier {
  if (!agent) return "anonymous";
  if (
    agent.capabilities?.some((c) => c.toLowerCase().includes("premium")) ||
    agent.trust_tier === "expert"
  ) {
    return "premium";
  }
  return "authenticated";
}

// Export the limits map so route handlers can show them
export { LIMITS as RATE_LIMIT_TIERS };
