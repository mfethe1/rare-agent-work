import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';

/**
 * Global rate limiting middleware.
 *
 * Applies tiered rate limits to API routes:
 *   - /api/chat, /api/v1/ask, /ask  → "llm" tier  (20 req/min)
 *   - /api/consulting, /api/submit-work → "form" tier (5 req/hr)
 *   - /api/news/vote               → "vote" tier (60 req/min)
 *   - /api/*                       → "api" tier  (120 req/min)
 *
 * Non-API routes are not rate-limited.
 * Returns standard X-RateLimit-* headers on every API response.
 */

type Tier = 'api' | 'llm' | 'form' | 'vote';

function resolveTier(pathname: string): Tier | null {
  // LLM-calling endpoints — most expensive
  if (pathname === '/api/chat' || pathname === '/api/v1/ask' || pathname === '/ask') {
    return 'llm';
  }
  // Form submissions — spam-sensitive
  if (pathname === '/api/consulting' || pathname === '/api/submit-work') {
    return 'form';
  }
  // Lightweight interactions
  if (pathname === '/api/news/vote') {
    return 'vote';
  }
  // General API traffic
  if (pathname.startsWith('/api/') || pathname.startsWith('/api')) {
    return 'api';
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const tier = resolveTier(pathname);

  // Not an API route — skip
  if (!tier) return NextResponse.next();

  // Skip rate limiting for internal service-to-service calls
  const ingestKey = request.headers.get('x-ingest-key');
  if (ingestKey && ingestKey === process.env.INGEST_API_KEY) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  const result = await rateLimit(ip, tier);
  const headers = rateLimitHeaders(result);

  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded. Please slow down and retry shortly.',
        retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
      },
      { status: 429, headers },
    );
  }

  // Attach rate limit headers to the successful response
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: ['/api/:path*', '/ask'],
};
