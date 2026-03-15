/**
 * Shared API headers utility for all v1 routes.
 * Provides CORS headers, API versioning, and per-request unique IDs.
 */

export const API_VERSION = "1.0.0";

/**
 * Generate a fresh set of CORS + metadata headers for each response.
 * Every call produces a unique X-Request-Id.
 */
export function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-RateLimit-Remaining": "100",
    "X-API-Version": API_VERSION,
    "X-Request-Id": crypto.randomUUID(),
  };
}

export function getCorsHeadersGet(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-RateLimit-Remaining": "100",
    "X-API-Version": API_VERSION,
    "X-Request-Id": crypto.randomUUID(),
  };
}

export function getCorsHeadersPost(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-RateLimit-Remaining": "100",
    "X-API-Version": API_VERSION,
    "X-Request-Id": crypto.randomUUID(),
  };
}

// ─── Static variants (for OPTIONS handlers and backward compat) ────────────────

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-RateLimit-Remaining": "100",
  "X-API-Version": API_VERSION,
};

export const CORS_HEADERS_GET: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-RateLimit-Remaining": "100",
  "X-API-Version": API_VERSION,
};

export const CORS_HEADERS_POST: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-RateLimit-Remaining": "100",
  "X-API-Version": API_VERSION,
};
