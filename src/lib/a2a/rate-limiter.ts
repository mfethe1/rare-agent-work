/**
 * A2A Agent Rate Limiter & Quota System
 *
 * Implements per-agent, trust-tiered rate limiting using a sliding window
 * algorithm backed by the database. Each action type (task submission,
 * context writes, webhook subscriptions, routing requests) has separate
 * quotas that scale with trust level.
 *
 * Design principles:
 *   1. Agents self-regulate via GET /api/a2a/usage (transparent quotas).
 *   2. 429 responses include Retry-After headers and quota metadata.
 *   3. Trust upgrades (untrusted → verified → partner) unlock higher limits.
 *   4. Sliding windows prevent burst-then-idle abuse patterns.
 *   5. DB-backed for consistency across serverless instances.
 */

import type { AgentTrustLevel } from './types';
import { getServiceDb } from './auth';

// ──────────────────────────────────────────────
// Action Types & Quota Tiers
// ──────────────────────────────────────────────

/**
 * Rate-limited action categories.
 * Each maps to a separate counter and quota.
 */
export type RateLimitAction =
  | 'task.submit'        // POST /api/a2a/tasks
  | 'task.route'         // POST /api/a2a/tasks/route
  | 'task.update'        // PATCH /api/a2a/tasks/:id
  | 'context.write'      // POST /api/a2a/context
  | 'context.read'       // GET /api/a2a/context
  | 'subscription.create' // POST /api/a2a/subscriptions
  | 'feedback.submit';   // POST /api/a2a/tasks/:id/feedback

/**
 * Quota definition for a single action within a time window.
 */
export interface QuotaTier {
  /** Maximum requests allowed in the window. */
  max_requests: number;
  /** Window duration in seconds. */
  window_seconds: number;
  /** Daily absolute cap (0 = unlimited within per-window limits). */
  daily_cap: number;
}

/**
 * Trust-level → action → quota mapping.
 *
 * These are deliberately conservative for untrusted agents and generous
 * for partners. The idea: new agents prove themselves through the
 * reputation system, earn trust upgrades, and unlock higher throughput.
 */
export const QUOTA_TIERS: Record<AgentTrustLevel, Record<RateLimitAction, QuotaTier>> = {
  untrusted: {
    'task.submit':         { max_requests: 10,  window_seconds: 60,  daily_cap: 100 },
    'task.route':          { max_requests: 5,   window_seconds: 60,  daily_cap: 50 },
    'task.update':         { max_requests: 20,  window_seconds: 60,  daily_cap: 200 },
    'context.write':       { max_requests: 10,  window_seconds: 60,  daily_cap: 100 },
    'context.read':        { max_requests: 30,  window_seconds: 60,  daily_cap: 500 },
    'subscription.create': { max_requests: 3,   window_seconds: 60,  daily_cap: 10 },
    'feedback.submit':     { max_requests: 10,  window_seconds: 60,  daily_cap: 100 },
  },
  verified: {
    'task.submit':         { max_requests: 60,  window_seconds: 60,  daily_cap: 1000 },
    'task.route':          { max_requests: 30,  window_seconds: 60,  daily_cap: 500 },
    'task.update':         { max_requests: 120, window_seconds: 60,  daily_cap: 2000 },
    'context.write':       { max_requests: 60,  window_seconds: 60,  daily_cap: 1000 },
    'context.read':        { max_requests: 200, window_seconds: 60,  daily_cap: 5000 },
    'subscription.create': { max_requests: 10,  window_seconds: 60,  daily_cap: 50 },
    'feedback.submit':     { max_requests: 60,  window_seconds: 60,  daily_cap: 1000 },
  },
  partner: {
    'task.submit':         { max_requests: 300, window_seconds: 60,  daily_cap: 10000 },
    'task.route':          { max_requests: 150, window_seconds: 60,  daily_cap: 5000 },
    'task.update':         { max_requests: 600, window_seconds: 60,  daily_cap: 20000 },
    'context.write':       { max_requests: 300, window_seconds: 60,  daily_cap: 10000 },
    'context.read':        { max_requests: 1000, window_seconds: 60, daily_cap: 50000 },
    'subscription.create': { max_requests: 50,  window_seconds: 60,  daily_cap: 200 },
    'feedback.submit':     { max_requests: 300, window_seconds: 60,  daily_cap: 10000 },
  },
};

// ──────────────────────────────────────────────
// Rate Limit Check Result
// ──────────────────────────────────────────────

export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Current request count in the active window. */
  current_count: number;
  /** Maximum allowed in the window. */
  max_requests: number;
  /** Window duration in seconds. */
  window_seconds: number;
  /** Remaining requests in the current window. */
  remaining: number;
  /** When the current window resets (ISO-8601). */
  resets_at: string;
  /** Seconds until the window resets (for Retry-After header). */
  retry_after_seconds: number;
  /** Daily usage count. */
  daily_count: number;
  /** Daily cap. */
  daily_cap: number;
  /** Daily remaining. */
  daily_remaining: number;
}

// ──────────────────────────────────────────────
// Agent Usage Summary (for GET /api/a2a/usage)
// ──────────────────────────────────────────────

export interface AgentUsageSummary {
  agent_id: string;
  trust_level: AgentTrustLevel;
  /** Per-action usage and quota details. */
  actions: Record<RateLimitAction, {
    window: {
      current: number;
      limit: number;
      remaining: number;
      window_seconds: number;
      resets_at: string;
    };
    daily: {
      current: number;
      limit: number;
      remaining: number;
      resets_at: string;
    };
  }>;
  /** When this summary was computed. */
  computed_at: string;
}

// ──────────────────────────────────────────────
// Core Rate Limiting Logic
// ──────────────────────────────────────────────

/**
 * Check and record a rate-limited action for an agent.
 *
 * Uses a sliding window algorithm:
 *   1. Count actions in [now - window_seconds, now] from the DB.
 *   2. If under limit, insert the new action record and allow.
 *   3. If at/over limit, deny with retry-after metadata.
 *
 * Also enforces a daily absolute cap (rolling 24h window).
 */
export async function checkRateLimit(
  agentId: string,
  trustLevel: AgentTrustLevel,
  action: RateLimitAction,
): Promise<RateLimitResult> {
  const quota = QUOTA_TIERS[trustLevel][action];
  const now = new Date();
  const windowStart = new Date(now.getTime() - quota.window_seconds * 1000);
  const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(windowStart.getTime() + quota.window_seconds * 1000);
  const retryAfterSeconds = Math.ceil((windowEnd.getTime() - now.getTime()) / 1000);

  const db = getServiceDb();
  if (!db) {
    // If DB is unavailable, fail open (allow) to avoid blocking all agents
    return makeAllowedResult(quota, 0, 0, now);
  }

  // Count actions in the sliding window and daily window in parallel
  const [windowResult, dailyResult] = await Promise.all([
    db
      .from('a2a_rate_limit_log')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('action', action)
      .gte('created_at', windowStart.toISOString()),
    db
      .from('a2a_rate_limit_log')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('action', action)
      .gte('created_at', dayStart.toISOString()),
  ]);

  const windowCount = windowResult.count ?? 0;
  const dailyCount = dailyResult.count ?? 0;

  // Check window limit
  if (windowCount >= quota.max_requests) {
    return {
      allowed: false,
      current_count: windowCount,
      max_requests: quota.max_requests,
      window_seconds: quota.window_seconds,
      remaining: 0,
      resets_at: windowEnd.toISOString(),
      retry_after_seconds: Math.max(1, retryAfterSeconds),
      daily_count: dailyCount,
      daily_cap: quota.daily_cap,
      daily_remaining: Math.max(0, quota.daily_cap - dailyCount),
    };
  }

  // Check daily cap
  if (quota.daily_cap > 0 && dailyCount >= quota.daily_cap) {
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    return {
      allowed: false,
      current_count: windowCount,
      max_requests: quota.max_requests,
      window_seconds: quota.window_seconds,
      remaining: Math.max(0, quota.max_requests - windowCount),
      resets_at: dayEnd.toISOString(),
      retry_after_seconds: Math.ceil((dayEnd.getTime() - now.getTime()) / 1000),
      daily_count: dailyCount,
      daily_cap: quota.daily_cap,
      daily_remaining: 0,
    };
  }

  // Record the action (fire-and-forget for performance)
  db.from('a2a_rate_limit_log')
    .insert({ agent_id: agentId, action })
    .then(() => {});

  return {
    allowed: true,
    current_count: windowCount + 1,
    max_requests: quota.max_requests,
    window_seconds: quota.window_seconds,
    remaining: Math.max(0, quota.max_requests - windowCount - 1),
    resets_at: windowEnd.toISOString(),
    retry_after_seconds: 0,
    daily_count: dailyCount + 1,
    daily_cap: quota.daily_cap,
    daily_remaining: Math.max(0, quota.daily_cap - dailyCount - 1),
  };
}

function makeAllowedResult(
  quota: QuotaTier,
  windowCount: number,
  dailyCount: number,
  now: Date,
): RateLimitResult {
  const windowEnd = new Date(now.getTime() + quota.window_seconds * 1000);
  return {
    allowed: true,
    current_count: windowCount,
    max_requests: quota.max_requests,
    window_seconds: quota.window_seconds,
    remaining: Math.max(0, quota.max_requests - windowCount),
    resets_at: windowEnd.toISOString(),
    retry_after_seconds: 0,
    daily_count: dailyCount,
    daily_cap: quota.daily_cap,
    daily_remaining: Math.max(0, quota.daily_cap - dailyCount),
  };
}

// ──────────────────────────────────────────────
// Usage Summary (for self-service endpoint)
// ──────────────────────────────────────────────

const ALL_ACTIONS: RateLimitAction[] = [
  'task.submit',
  'task.route',
  'task.update',
  'context.write',
  'context.read',
  'subscription.create',
  'feedback.submit',
];

/**
 * Build a complete usage summary for an agent, showing current consumption
 * and remaining quota across all action types.
 *
 * This powers the GET /api/a2a/usage endpoint, enabling agents to
 * self-regulate and avoid 429 responses.
 */
export async function getAgentUsage(
  agentId: string,
  trustLevel: AgentTrustLevel,
): Promise<AgentUsageSummary> {
  const now = new Date();
  const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dayResets = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const db = getServiceDb();
  const actions = {} as AgentUsageSummary['actions'];

  for (const action of ALL_ACTIONS) {
    const quota = QUOTA_TIERS[trustLevel][action];
    const windowStart = new Date(now.getTime() - quota.window_seconds * 1000);
    const windowResets = new Date(windowStart.getTime() + quota.window_seconds * 1000);

    let windowCount = 0;
    let dailyCount = 0;

    if (db) {
      const [wResult, dResult] = await Promise.all([
        db
          .from('a2a_rate_limit_log')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', agentId)
          .eq('action', action)
          .gte('created_at', windowStart.toISOString()),
        db
          .from('a2a_rate_limit_log')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', agentId)
          .eq('action', action)
          .gte('created_at', dayStart.toISOString()),
      ]);
      windowCount = wResult.count ?? 0;
      dailyCount = dResult.count ?? 0;
    }

    actions[action] = {
      window: {
        current: windowCount,
        limit: quota.max_requests,
        remaining: Math.max(0, quota.max_requests - windowCount),
        window_seconds: quota.window_seconds,
        resets_at: windowResets.toISOString(),
      },
      daily: {
        current: dailyCount,
        limit: quota.daily_cap,
        remaining: Math.max(0, quota.daily_cap - dailyCount),
        resets_at: dayResets.toISOString(),
      },
    };
  }

  return {
    agent_id: agentId,
    trust_level: trustLevel,
    actions,
    computed_at: now.toISOString(),
  };
}

// ──────────────────────────────────────────────
// Response Helpers
// ──────────────────────────────────────────────

/**
 * Standard rate-limit response headers (always included on protected endpoints).
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.max_requests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': result.resets_at,
    'X-RateLimit-Daily-Limit': String(result.daily_cap),
    'X-RateLimit-Daily-Remaining': String(result.daily_remaining),
  };

  if (!result.allowed) {
    headers['Retry-After'] = String(result.retry_after_seconds);
  }

  return headers;
}

/**
 * Build the 429 response body with actionable information for the agent.
 */
export function rateLimitBody(action: RateLimitAction, result: RateLimitResult) {
  return {
    error: 'Rate limit exceeded.',
    code: 'rate_limit_exceeded',
    action,
    limit: result.max_requests,
    window_seconds: result.window_seconds,
    current: result.current_count,
    retry_after_seconds: result.retry_after_seconds,
    resets_at: result.resets_at,
    daily_count: result.daily_count,
    daily_cap: result.daily_cap,
    hint: 'Query GET /api/a2a/usage for full quota details. Upgrade trust level for higher limits.',
  };
}
