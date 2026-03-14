import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';

/**
 * Edge middleware — three layers applied to every matched request:
 *
 * 1. **Security headers** — CSP, HSTS, X-Frame-Options, etc. on every response.
 * 2. **Rate limiting** — tiered limits on API/auth endpoints (Redis-backed).
 * 3. **Auth gating** — /account/* requires an active Supabase session.
 * 4. **Request ID** — X-Request-Id for log correlation.
 */

// ── Security headers ────────────────────────────────────────────────────

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self)',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-DNS-Prefetch-Control': 'on',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://googleads.g.doubleclick.net https://www.googleadservices.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com https://googleads.g.doubleclick.net",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

function applySecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  response.headers.set('Content-Security-Policy', CSP);
}

// ── Rate-limit tier resolution ──────────────────────────────────────────

type Tier = 'api' | 'llm' | 'form' | 'vote' | 'auth';

function resolveTier(pathname: string): Tier | null {
  if (pathname === '/api/chat' || pathname === '/api/v1/ask' || pathname === '/ask') return 'llm';
  if (pathname === '/api/consulting' || pathname === '/api/submit-work') return 'form';
  if (pathname === '/api/news/vote') return 'vote';
  if (pathname.startsWith('/auth')) return 'auth';
  if (pathname.startsWith('/api/') || pathname.startsWith('/api')) return 'api';
  return null;
}

// Auth tier: 15 req/min to deter brute-force (uses 'form' bucket in rate-limit lib for now)
const AUTH_TIER_MAP: Record<string, Tier> = { auth: 'form' };

// ── Auth-protected route prefixes ───────────────────────────────────────

const PROTECTED_PREFIXES = ['/account'];

// ── Middleware entry point ───────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate limiting (API + auth routes)
  const tier = resolveTier(pathname);
  let rlHeaders: Record<string, string> = {};

  if (tier) {
    // Skip rate limiting for internal service-to-service calls
    const ingestKey = request.headers.get('x-ingest-key');
    const isInternal = ingestKey && ingestKey === process.env.INGEST_API_KEY;

    if (!isInternal) {
      const ip = getClientIp(request);
      const effectiveTier = AUTH_TIER_MAP[tier] ?? tier;
      const result = await rateLimit(ip, effectiveTier as 'api' | 'llm' | 'form' | 'vote');
      rlHeaders = rateLimitHeaders(result);

      if (!result.success) {
        const blockedResponse = NextResponse.json(
          {
            error: 'Rate limit exceeded. Please slow down and retry shortly.',
            retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
          },
          { status: 429, headers: rlHeaders },
        );
        applySecurityHeaders(blockedResponse);
        return blockedResponse;
      }
    }
  }

  // 2. Auth gating for protected routes
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  let response = NextResponse.next({ request });

  if (isProtected) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      });

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/auth/login';
        loginUrl.searchParams.set('redirect', pathname);
        const redirectResponse = NextResponse.redirect(loginUrl);
        applySecurityHeaders(redirectResponse);
        return redirectResponse;
      }
    }
  }

  // 3. Request ID for observability
  response.headers.set('X-Request-Id', crypto.randomUUID());

  // 4. Security headers on every response
  applySecurityHeaders(response);

  // 5. Rate-limit headers on API responses
  for (const [key, value] of Object.entries(rlHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

// Match all routes except static assets and Next.js internals
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|logo-.*|og-image\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$).*)',
  ],
};
