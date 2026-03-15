import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  publishPackageSchema,
  searchPackagesSchema,
  publishPackage,
  searchPackages,
} from '@/lib/a2a/marketplace';

/**
 * GET /api/a2a/marketplace/packages — Search marketplace packages.
 *
 * Query params: query, category, tags, license, min_rating, sort_by, limit, offset
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const raw: Record<string, unknown> = {};
    for (const key of ['query', 'category', 'license', 'sort_by']) {
      const v = url.searchParams.get(key);
      if (v) raw[key] = v;
    }
    for (const key of ['limit', 'offset', 'min_rating']) {
      const v = url.searchParams.get(key);
      if (v) raw[key] = Number(v);
    }
    const tags = url.searchParams.get('tags');
    if (tags) raw.tags = tags.split(',');

    const params = searchPackagesSchema.parse(raw);
    const result = await searchPackages(params);

    return NextResponse.json(result);
  } catch (err) {
    console.error('[marketplace/search]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}

/**
 * POST /api/a2a/marketplace/packages — Publish a new capability package.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = publishPackageSchema.parse(body);

    const pkg = await publishPackage({
      ...input,
      publisher_agent_id: agent.id,
      publisher_name: agent.name,
    });

    return NextResponse.json(
      {
        package_id: pkg.id,
        name: pkg.name,
        version: pkg.version,
        status: pkg.status,
        created_at: pkg.created_at,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[marketplace/publish]', err);
    const status = err instanceof Error && err.message.includes('already taken') ? 409 : 400;
    return NextResponse.json(safeErrorBody(err), { status });
  }
}
