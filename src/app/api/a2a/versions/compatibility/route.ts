import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkCompatibility, listMigrations } from '@/lib/a2a/versioning';
import { compatibilityCheckSchema } from '@/lib/a2a/versioning/validation';

/**
 * GET /api/a2a/versions/compatibility — Check compatibility between two versions.
 *
 * Query parameters: capability_id, source_version, target_version
 *
 * Returns the compatibility level (full, backward, negotiable, breaking)
 * and whether a migration path exists for cross-major-version interop.
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
    const params = {
      capability_id: url.searchParams.get('capability_id') ?? '',
      source_version: url.searchParams.get('source_version') ?? '',
      target_version: url.searchParams.get('target_version') ?? '',
    };

    const parsed = compatibilityCheckSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { capability_id, source_version, target_version } = parsed.data;

    // Check if migration paths exist for this capability
    const migrations = await listMigrations(capability_id);
    const hasMigrationPath = migrations.some(
      (m) =>
        (m.from_version === source_version && m.to_version === target_version) ||
        (m.bidirectional && m.from_version === target_version && m.to_version === source_version),
    );

    const result = checkCompatibility(source_version, target_version, hasMigrationPath);

    // If there's a migration path, include its ID
    if (hasMigrationPath) {
      const migration = migrations.find(
        (m) =>
          (m.from_version === source_version && m.to_version === target_version) ||
          (m.bidirectional && m.from_version === target_version && m.to_version === source_version),
      );
      if (migration) {
        result.migration_path_id = migration.id;
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[A2A versions compatibility GET]', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
