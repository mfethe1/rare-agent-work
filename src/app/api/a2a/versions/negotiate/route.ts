import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent, getServiceDb } from '@/lib/a2a';
import { negotiateBatch, listVersions, listMigrations } from '@/lib/a2a/versioning';
import { versionNegotiateSchema } from '@/lib/a2a/versioning/validation';

/**
 * POST /api/a2a/versions/negotiate — Negotiate capability versions between agents.
 *
 * The consumer agent sends version constraints for one or more capabilities,
 * and the platform resolves the best compatible version with the provider.
 *
 * Body: {
 *   provider_agent_id: string,
 *   constraints: [{ capability_id, min_version?, max_version?, preferred_version?, accept_deprecated? }]
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
    const parsed = versionNegotiateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { provider_agent_id, constraints } = parsed.data;

    // Gather all unique capability IDs
    const capIds = [...new Set(constraints.map((c) => c.capability_id))];

    // Fetch provider versions and migration paths for all requested capabilities
    const [allVersions, allMigrations] = await Promise.all([
      Promise.all(capIds.map((id) => listVersions(id))).then((arrays) => arrays.flat()),
      Promise.all(capIds.map((id) => listMigrations(id))).then((arrays) => arrays.flat()),
    ]);

    // Filter to provider's versions only
    const providerVersions = allVersions.filter(
      (v) => v.published_by_agent_id === provider_agent_id,
    );

    const { results, all_resolved } = negotiateBatch(
      agent.id,
      provider_agent_id,
      constraints,
      providerVersions,
      allMigrations,
    );

    // Log negotiation results for analytics
    const db = getServiceDb();
    if (db) {
      const logs = results.map((r) => ({
        capability_id: r.capability_id,
        consumer_agent_id: r.consumer_agent_id,
        provider_agent_id: r.provider_agent_id,
        success: r.success,
        consumer_version: r.consumer_version ?? null,
        provider_version: r.provider_version ?? null,
        compatibility_level: r.compatibility_level ?? null,
        requires_migration: r.requires_migration,
        migration_path_id: r.migration_path_id ?? null,
        failure_reason: r.failure_reason ?? null,
      }));

      // Fire and forget — don't block on audit logging
      db.from('a2a_version_negotiations').insert(logs).then();
    }

    return NextResponse.json({
      results,
      all_resolved,
    });
  } catch (err) {
    console.error('[A2A versions negotiate POST]', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
