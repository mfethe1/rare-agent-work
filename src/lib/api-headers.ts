/**
 * Shared API headers utility for all v1 routes.
 * Provides CORS headers, API versioning, and per-request unique IDs.
 * Updated Round 27: real rate limit headers.
 */

export const API_VERSION = "1.0.0";

export interface RateLimitMeta {
  limit: number;
  remaining: number;
  reset_at: string;
}

/**
 * Generate a fresh set of CORS + metadata headers for each response.
 * Every call produces a unique X-Request-Id.
 * Pass rl for real rate limit headers; omits them with safe defaults if not provided.
 */
export function getCorsHeaders(rl?: RateLimitMeta): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-RateLimit-Limit": String(rl?.limit ?? 600),
    "X-RateLimit-Remaining": String(rl?.remaining ?? 100),
    "X-RateLimit-Reset": rl?.reset_at ?? new Date(Date.now() + 3600000).toISOString(),
    "X-API-Version": API_VERSION,
    "X-Request-Id": crypto.randomUUID(),
  };
}

export function getCorsHeadersGet(rl?: RateLimitMeta): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-RateLimit-Limit": String(rl?.limit ?? 600),
    "X-RateLimit-Remaining": String(rl?.remaining ?? 100),
    "X-RateLimit-Reset": rl?.reset_at ?? new Date(Date.now() + 3600000).toISOString(),
    "X-API-Version": API_VERSION,
    "X-Request-Id": crypto.randomUUID(),
  };
}

export function getCorsHeadersPost(rl?: RateLimitMeta): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-RateLimit-Limit": String(rl?.limit ?? 600),
    "X-RateLimit-Remaining": String(rl?.remaining ?? 100),
    "X-RateLimit-Reset": rl?.reset_at ?? new Date(Date.now() + 3600000).toISOString(),
    "X-API-Version": API_VERSION,
    "X-Request-Id": crypto.randomUUID(),
  };
}

// ─── Static variants (for OPTIONS handlers and backward compat) ────────────────

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-RateLimit-Limit": "600",
  "X-RateLimit-Remaining": "100",
  "X-API-Version": API_VERSION,
};

export const CORS_HEADERS_GET: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-RateLimit-Limit": "600",
  "X-RateLimit-Remaining": "100",
  "X-API-Version": API_VERSION,
};

export const CORS_HEADERS_POST: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-RateLimit-Limit": "600",
  "X-RateLimit-Remaining": "100",
  "X-API-Version": API_VERSION,
};
