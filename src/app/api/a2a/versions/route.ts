import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  publishVersion,
  deprecateVersion,
  listVersions,
  VersionError,
} from '@/lib/a2a/versioning';
import {
  versionPublishSchema,
  versionDeprecateSchema,
  versionListSchema,
} from '@/lib/a2a/versioning/validation';

/**
 * GET /api/a2a/versions — List versions for a capability.
 *
 * Query parameters:
 *   capability_id (required), lifecycle (comma-separated, optional)
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required. Provide a valid Bearer token.' },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const capabilityId = url.searchParams.get('capability_id') ?? '';
    const lifecycleParam = url.searchParams.get('lifecycle');
    const lifecycle = lifecycleParam ? lifecycleParam.split(',') : undefined;

    const parsed = versionListSchema.safeParse({
      capability_id: capabilityId,
      lifecycle,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const versions = await listVersions(parsed.data.capability_id, parsed.data.lifecycle as any);

    return NextResponse.json({
      versions,
      count: versions.length,
    });
  } catch (err) {
    console.error('[A2A versions GET]', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * POST /api/a2a/versions — Publish a new capability version.
 *
 * Body: { capability_id, version, changelog, input_schema?, output_schema? }
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required. Provide a valid Bearer token.' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const parsed = versionPublishSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const version = await publishVersion(
      agent.id,
      parsed.data.capability_id,
      parsed.data.version,
      parsed.data.changelog,
      parsed.data.input_schema,
      parsed.data.output_schema,
    );

    return NextResponse.json(
      {
        version_id: version.id,
        capability_id: version.capability_id,
        version: version.version,
        lifecycle: version.lifecycle,
        created_at: version.created_at,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof VersionError) {
      const status = err.code === 'VERSION_EXISTS' ? 409 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error('[A2A versions POST]', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * PATCH /api/a2a/versions — Deprecate a version.
 *
 * Body: { version_id, sunset_at, deprecation_message, recommended_version }
 */
export async function PATCH(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required. Provide a valid Bearer token.' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const versionId = body.version_id;

    if (!versionId || typeof versionId !== 'string') {
      return NextResponse.json(
        { error: 'version_id is required.' },
        { status: 400 },
      );
    }

    const parsed = versionDeprecateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const version = await deprecateVersion(
      versionId,
      agent.id,
      parsed.data.sunset_at,
      parsed.data.deprecation_message,
      parsed.data.recommended_version,
    );

    return NextResponse.json({
      version_id: version.id,
      capability_id: version.capability_id,
      version: version.version,
      lifecycle: version.lifecycle,
      deprecated_at: version.deprecated_at,
      sunset_at: version.sunset_at,
      updated_at: version.updated_at,
    });
  } catch (err) {
    if (err instanceof VersionError) {
      const statusMap: Record<string, number> = {
        VERSION_NOT_FOUND: 404,
        NOT_OWNER: 403,
        INVALID_TRANSITION: 409,
      };
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: statusMap[err.code] ?? 400 },
      );
    }
    console.error('[A2A versions PATCH]', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
