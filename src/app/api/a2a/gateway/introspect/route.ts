import { NextResponse } from 'next/server';
import {
  introspectionQuerySchema,
  buildIntrospection,
} from '@/lib/a2a/gateway';

/**
 * GET /api/a2a/gateway/introspect — Machine-readable API catalog.
 *
 * This is the self-describing entry point that agents use to understand the
 * entire platform surface at runtime. No hardcoded knowledge of individual
 * endpoints is needed — agents query this once, discover available domains
 * and endpoints, then compose batch operations or subscribe to streams.
 *
 * Supports filtering by:
 * - domain: Only return endpoints in a specific domain
 * - tag: Only return endpoints with a specific tag
 * - method: Only return endpoints with a specific HTTP method
 * - requires_auth: Filter by authentication requirement
 * - search: Free-text search across endpoint descriptions
 * - include_schemas: Include full request/response JSON schemas
 *
 * No authentication required — this is a discovery endpoint.
 * Responses are cached for 1 hour.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawParams: Record<string, unknown> = {};

  for (const [key, value] of url.searchParams) {
    rawParams[key] = value;
  }

  const parsed = introspectionQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid introspection query.',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const introspection = buildIntrospection(parsed.data);

  return NextResponse.json(introspection, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'X-Total-Endpoints': String(introspection.total_endpoints),
      'X-Total-Domains': String(introspection.domains.length),
    },
  });
}
