/**
 * Universal cost gate — enforces spend limits per user/IP across any app.
 *
 * Usage:
 *   const gate = await checkCostGate({ userId: 'anon', ip: '1.2.3.4', app: 'ai-guide' });
 *   if (gate.blocked) return Response(gate.error, { status: 402 });
 *
 * Cost limits are defined per tier and can be overridden per app.
 * This module is designed to be used by any system that incurs API costs:
 * - AI Guide chatbot
 * - Report generation pipeline
 * - News ingestion (if using paid APIs)
 * - Future: any new cost-bearing feature
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ──────────────────────────────────────────────
// Cost limit configuration (provider cost, not markup)
// ──────────────────────────────────────────────

export interface CostLimits {
  /** Max provider cost per week (USD) */
  weeklyLimit: number;
  /** Max provider cost per month (USD) */
  monthlyLimit: number;
  /** Max requests per day */
  dailyRequestLimit: number;
  /** Max requests per week */
  weeklyRequestLimit: number;
}

/**
 * Default limits by tier.
 * These are PROVIDER costs — the actual Anthropic/OpenAI bill.
 * Billed costs to users include the 30% markup on top.
 */
const TIER_LIMITS: Record<string, CostLimits> = {
  free: {
    weeklyLimit: 2.00,        // $2/week hard cap (provider cost)
    monthlyLimit: 8.00,       // ~$8/month
    dailyRequestLimit: 10,    // 10 requests/day
    weeklyRequestLimit: 40,   // 40 requests/week
  },
  starter: {
    weeklyLimit: 15.00,
    monthlyLimit: 50.00,
    dailyRequestLimit: 100,
    weeklyRequestLimit: 500,
  },
  pro: {
    weeklyLimit: 60.00,
    monthlyLimit: 200.00,
    dailyRequestLimit: 500,
    weeklyRequestLimit: 2500,
  },
  // Internal/pipeline use — higher limits
  system: {
    weeklyLimit: 100.00,
    monthlyLimit: 400.00,
    dailyRequestLimit: 10000,
    weeklyRequestLimit: 50000,
  },
};

/**
 * Per-app limit overrides (optional).
 * If an app has tighter limits than the tier default, they take precedence.
 */
const APP_OVERRIDES: Record<string, Partial<Record<string, Partial<CostLimits>>>> = {
  'ai-guide': {
    free: {
      weeklyLimit: 2.00,
      dailyRequestLimit: 5,
      weeklyRequestLimit: 20,
    },
  },
  'report-pipeline': {
    // Pipeline runs are system-level, higher budget
    system: {
      weeklyLimit: 50.00,
    },
  },
  'news-ingest': {
    system: {
      weeklyLimit: 10.00,
    },
  },
};

// ──────────────────────────────────────────────
// Gate check
// ──────────────────────────────────────────────

export interface CostGateInput {
  /** User ID (UUID or 'anon') */
  userId?: string;
  /** User email (for logging) */
  userEmail?: string;
  /** IP address (for anonymous rate limiting) */
  ip?: string;
  /** App identifier */
  app: string;
  /** User tier */
  tier?: string;
}

export interface CostGateResult {
  blocked: boolean;
  reason?: string;
  error?: string;
  /** Current spend this week (provider cost) */
  weeklySpend: number;
  /** Current spend this month (provider cost) */
  monthlySpend: number;
  /** Requests today */
  dailyRequests: number;
  /** Requests this week */
  weeklyRequests: number;
  /** Effective limits applied */
  limits: CostLimits;
}

function getDb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getEffectiveLimits(tier: string, app: string): CostLimits {
  const base = TIER_LIMITS[tier] || TIER_LIMITS.free;
  const appOverride = APP_OVERRIDES[app]?.[tier];
  if (!appOverride) return { ...base };
  return {
    weeklyLimit: appOverride.weeklyLimit ?? base.weeklyLimit,
    monthlyLimit: appOverride.monthlyLimit ?? base.monthlyLimit,
    dailyRequestLimit: appOverride.dailyRequestLimit ?? base.dailyRequestLimit,
    weeklyRequestLimit: appOverride.weeklyRequestLimit ?? base.weeklyRequestLimit,
  };
}

function startOfDay(): string {
  return new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z').toISOString();
}

function startOfWeek(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now);
  monday.setUTCDate(diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
}

function startOfMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function checkCostGate(input: CostGateInput): Promise<CostGateResult> {
  const tier = input.tier || 'free';
  const limits = getEffectiveLimits(tier, input.app);

  const db = getDb();
  if (!db) {
    // No DB = can't enforce limits, allow but log warning
    return {
      blocked: false,
      weeklySpend: 0,
      monthlySpend: 0,
      dailyRequests: 0,
      weeklyRequests: 0,
      limits,
    };
  }

  // Determine the identity column to query
  const identityFilter = input.userId && input.userId !== 'anon'
    ? { column: 'user_id', value: input.userId }
    : { column: 'ip_address', value: input.ip || 'unknown' };

  // Fetch usage stats in parallel
  const [dailyRes, weeklyRes, monthlyRes] = await Promise.all([
    // Daily requests
    db.from('token_usage')
      .select('id', { count: 'exact', head: true })
      .eq(identityFilter.column, identityFilter.value)
      .eq('app', input.app)
      .gte('created_at', startOfDay()),

    // Weekly: requests + cost
    db.from('token_usage')
      .select('cost_usd')
      .eq(identityFilter.column, identityFilter.value)
      .eq('app', input.app)
      .gte('created_at', startOfWeek()),

    // Monthly cost
    db.from('token_usage')
      .select('cost_usd')
      .eq(identityFilter.column, identityFilter.value)
      .eq('app', input.app)
      .gte('created_at', startOfMonth()),
  ]);

  const dailyRequests = dailyRes.count ?? 0;
  const weeklyData = weeklyRes.data ?? [];
  const monthlyData = monthlyRes.data ?? [];

  const weeklyRequests = weeklyData.length;
  const weeklySpend = weeklyData.reduce((sum, row) => sum + (row.cost_usd ?? 0), 0);
  const monthlySpend = monthlyData.reduce((sum, row) => sum + (row.cost_usd ?? 0), 0);

  // Check limits
  if (weeklySpend >= limits.weeklyLimit) {
    return {
      blocked: true,
      reason: 'weekly_cost_limit',
      error: tier === 'free'
        ? `Weekly free usage limit reached ($${limits.weeklyLimit.toFixed(2)}). Sign up for a plan to continue.`
        : `Weekly spend limit reached ($${limits.weeklyLimit.toFixed(2)}). Upgrade your plan for higher limits.`,
      weeklySpend,
      monthlySpend,
      dailyRequests,
      weeklyRequests,
      limits,
    };
  }

  if (monthlySpend >= limits.monthlyLimit) {
    return {
      blocked: true,
      reason: 'monthly_cost_limit',
      error: `Monthly spend limit reached ($${limits.monthlyLimit.toFixed(2)}). Resets next month.`,
      weeklySpend,
      monthlySpend,
      dailyRequests,
      weeklyRequests,
      limits,
    };
  }

  if (dailyRequests >= limits.dailyRequestLimit) {
    return {
      blocked: true,
      reason: 'daily_request_limit',
      error: tier === 'free'
        ? `Daily limit reached (${limits.dailyRequestLimit} requests). Try again tomorrow or sign up.`
        : `Daily request limit reached (${limits.dailyRequestLimit}). Try again tomorrow.`,
      weeklySpend,
      monthlySpend,
      dailyRequests,
      weeklyRequests,
      limits,
    };
  }

  if (weeklyRequests >= limits.weeklyRequestLimit) {
    return {
      blocked: true,
      reason: 'weekly_request_limit',
      error: `Weekly request limit reached (${limits.weeklyRequestLimit}). Resets Monday.`,
      weeklySpend,
      monthlySpend,
      dailyRequests,
      weeklyRequests,
      limits,
    };
  }

  return {
    blocked: false,
    weeklySpend,
    monthlySpend,
    dailyRequests,
    weeklyRequests,
    limits,
  };
}
