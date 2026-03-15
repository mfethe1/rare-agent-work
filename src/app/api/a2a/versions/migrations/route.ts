import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { registerMigration, listMigrations, VersionError } from '@/lib/a2a/versioning';
import { migrationRegisterSchema } from '@/lib/a2a/versioning/validation';

/**
 * GET /api/a2a/versions/migrations — List migration paths for a capability.
 *
 * Query parameters: capability_id (required)
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
    const capabilityId = url.searchParams.get('capability_id');

    if (!capabilityId) {
      return NextResponse.json(
        { error: 'capability_id query parameter is required.' },
        { status: 400 },
      );
    }

    const migrations = await listMigrations(capabilityId);

    return NextResponse.json({
      migrations,
      count: migrations.length,
    });
  } catch (err) {
    console.error('[A2A migrations GET]', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * POST /api/a2a/versions/migrations — Register a migration path between versions.
 *
 * Body: {
 *   capability_id, from_version, to_version, bidirectional,
 *   input_transforms, output_transforms
 * }
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
    const parsed = migrationRegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const migration = await registerMigration(
      agent.id,
      parsed.data.capability_id,
      parsed.data.from_version,
      parsed.data.to_version,
      parsed.data.bidirectional,
      parsed.data.input_transforms,
      parsed.data.output_transforms,
    );

    return NextResponse.json(
      {
        migration_id: migration.id,
        capability_id: migration.capability_id,
        from_version: migration.from_version,
        to_version: migration.to_version,
        validated: migration.validated,
        created_at: migration.created_at,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof VersionError) {
      const status = err.code === 'MIGRATION_EXISTS' ? 409 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error('[A2A migrations POST]', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
