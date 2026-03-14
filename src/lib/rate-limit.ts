/**
 * Redis-backed rate limiting using @upstash/ratelimit
 *
 * Provides tiered rate limiters for different endpoint categories:
 * - api:      General API traffic (120 req/min)
 * - llm:      LLM-calling endpoints (20 req/min) — protects against cost abuse
 * - form:     Form submissions (5 req/hour) — prevents spam
 * - vote:     Lightweight interactions (60 req/min)
 *
 * Falls open if Redis is unavailable (availability > strictness).
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type LimiterTier = 'api' | 'llm' | 'form' | 'vote';

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms
}

const TIER_CONFIG: Record<LimiterTier, { requests: number; window: string }> = {
  api:  { requests: 120, window: '60 s' },
  llm:  { requests: 20,  window: '60 s' },
  form: { requests: 5,   window: '3600 s' },
  vote: { requests: 60,  window: '60 s' },
};

let redis: Redis | null = null;
const limiters = new Map<LimiterTier, Ratelimit>();

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function getLimiter(tier: LimiterTier): Ratelimit | null {
  if (limiters.has(tier)) return limiters.get(tier)!;
  const r = getRedis();
  if (!r) return null;
  const cfg = TIER_CONFIG[tier];
  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(cfg.requests, cfg.window as `${number} ${'s' | 'ms' | 'm' | 'h' | 'd'}`),
    prefix: `rl:${tier}`,
    analytics: false,
  });
  limiters.set(tier, limiter);
  return limiter;
}

/**
 * Check rate limit for a given identifier (usually IP address).
 * Returns success=true if the request should proceed.
 * Falls open if Redis is unreachable.
 */
export async function rateLimit(
  identifier: string,
  tier: LimiterTier = 'api',
): Promise<RateLimitResult> {
  const cfg = TIER_CONFIG[tier];

  try {
    const limiter = getLimiter(tier);
    if (!limiter) {
      // Redis not configured — fail open
      return { success: true, limit: cfg.requests, remaining: cfg.requests, reset: Date.now() + 60_000 };
    }
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (err) {
    console.error(`[RateLimit] Redis error for tier=${tier}:`, err instanceof Error ? err.message : err);
    // Fail open — don't block traffic when Redis is down
    return { success: true, limit: cfg.requests, remaining: cfg.requests, reset: Date.now() + 60_000 };
  }
}

/**
 * Extract client IP from a request, respecting x-forwarded-for.
 */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Build standard rate limit response headers.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(result.reset),
    ...(result.success ? {} : { 'Retry-After': String(Math.ceil((result.reset - Date.now()) / 1000)) }),
  };
}
