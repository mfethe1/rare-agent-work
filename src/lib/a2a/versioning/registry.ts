/**
 * Capability Version Registry & Deprecation Lifecycle Manager
 *
 * Manages the full lifecycle of capability versions on the platform:
 * - Publishing new versions with schema validation
 * - Deprecation with sunset scheduling
 * - Automated lifecycle transitions (sunset enforcement)
 * - Migration path registration and validation
 * - Version queries for routing and negotiation
 */

import type {
  CapabilityVersion,
  VersionLifecycle,
  MigrationPath,
  FieldTransform,
  SemVer,
} from './types';
import { parseSemVer, formatSemVer, compareSemVerStrings } from './semver';

// ──────────────────────────────────────────────
// Version Publishing
// ──────────────────────────────────────────────

/**
 * Publish a new capability version to the registry.
 * Validates semver, ensures no duplicate, and persists to DB.
 */
export async function publishVersion(
  agentId: string,
  capabilityId: string,
  version: string,
  changelog: string,
  inputSchema?: Record<string, unknown>,
  outputSchema?: Record<string, unknown>,
): Promise<CapabilityVersion> {
  const semver = parseSemVer(version);
  if (!semver) {
    throw new VersionError('INVALID_SEMVER', `"${version}" is not a valid semver string.`);
  }

  const db = await getDb();
  if (!db) throw new VersionError('DB_UNAVAILABLE', 'Database not available.');

  // Check for duplicate
  const { data: existing } = await db
    .from('a2a_capability_versions')
    .select('id')
    .eq('capability_id', capabilityId)
    .eq('version', version)
    .maybeSingle();

  if (existing) {
    throw new VersionError(
      'VERSION_EXISTS',
      `Version ${version} already exists for capability "${capabilityId}".`,
    );
  }

  const now = new Date().toISOString();
  const record = {
    capability_id: capabilityId,
    version,
    major: semver.major,
    minor: semver.minor,
    patch: semver.patch,
    prerelease: semver.prerelease ?? null,
    lifecycle: 'active' as VersionLifecycle,
    changelog,
    published_by_agent_id: agentId,
    input_schema: inputSchema ?? null,
    output_schema: outputSchema ?? null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await db
    .from('a2a_capability_versions')
    .insert(record)
    .select()
    .single();

  if (error || !data) {
    throw new VersionError('PUBLISH_FAILED', `Failed to publish version: ${error?.message}`);
  }

  return mapRowToCapabilityVersion(data);
}

// ──────────────────────────────────────────────
// Deprecation Lifecycle
// ──────────────────────────────────────────────

/**
 * Deprecate a capability version with a sunset date and migration guidance.
 *
 * Lifecycle transition: active → deprecated
 * Once deprecated, the version still works but agents receive warnings.
 * At the sunset date, the platform transitions to 'sunset' status.
 */
export async function deprecateVersion(
  versionId: string,
  agentId: string,
  sunsetAt: string,
  deprecationMessage: string,
  recommendedVersion: string,
): Promise<CapabilityVersion> {
  const db = await getDb();
  if (!db) throw new VersionError('DB_UNAVAILABLE', 'Database not available.');

  // Validate the version belongs to this agent and is active
  const { data: existing } = await db
    .from('a2a_capability_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  if (!existing) {
    throw new VersionError('VERSION_NOT_FOUND', `Version ${versionId} not found.`);
  }
  if (existing.published_by_agent_id !== agentId) {
    throw new VersionError('NOT_OWNER', 'Only the publishing agent can deprecate a version.');
  }
  if (existing.lifecycle !== 'active') {
    throw new VersionError(
      'INVALID_TRANSITION',
      `Cannot deprecate a version in "${existing.lifecycle}" state. Only active versions can be deprecated.`,
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await db
    .from('a2a_capability_versions')
    .update({
      lifecycle: 'deprecated',
      deprecated_at: now,
      sunset_at: sunsetAt,
      deprecation_message: deprecationMessage,
      recommended_version: recommendedVersion,
      updated_at: now,
    })
    .eq('id', versionId)
    .select()
    .single();

  if (error || !data) {
    throw new VersionError('DEPRECATE_FAILED', `Failed to deprecate: ${error?.message}`);
  }

  return mapRowToCapabilityVersion(data);
}

/**
 * Enforce sunset deadlines: transition deprecated versions past their
 * sunset date to 'sunset' status. Called periodically by the platform.
 *
 * Returns the number of versions transitioned.
 */
export async function enforceSunsets(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const now = new Date().toISOString();

  const { data, error } = await db
    .from('a2a_capability_versions')
    .update({ lifecycle: 'sunset', updated_at: now })
    .eq('lifecycle', 'deprecated')
    .lte('sunset_at', now)
    .select('id');

  if (error || !data) return 0;
  return data.length;
}

/**
 * Remove a sunset version permanently.
 * Lifecycle transition: sunset → removed
 */
export async function removeVersion(versionId: string, agentId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new VersionError('DB_UNAVAILABLE', 'Database not available.');

  const { data: existing } = await db
    .from('a2a_capability_versions')
    .select('published_by_agent_id, lifecycle')
    .eq('id', versionId)
    .single();

  if (!existing) {
    throw new VersionError('VERSION_NOT_FOUND', `Version ${versionId} not found.`);
  }
  if (existing.published_by_agent_id !== agentId) {
    throw new VersionError('NOT_OWNER', 'Only the publishing agent can remove a version.');
  }
  if (existing.lifecycle !== 'sunset') {
    throw new VersionError(
      'INVALID_TRANSITION',
      `Cannot remove a version in "${existing.lifecycle}" state. Only sunset versions can be removed.`,
    );
  }

  await db
    .from('a2a_capability_versions')
    .update({ lifecycle: 'removed', updated_at: new Date().toISOString() })
    .eq('id', versionId);
}

// ──────────────────────────────────────────────
// Version Queries
// ──────────────────────────────────────────────

/**
 * List all versions for a capability, optionally filtered by lifecycle.
 */
export async function listVersions(
  capabilityId: string,
  lifecycle?: VersionLifecycle[],
): Promise<CapabilityVersion[]> {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .from('a2a_capability_versions')
    .select('*')
    .eq('capability_id', capabilityId)
    .order('major', { ascending: false })
    .order('minor', { ascending: false })
    .order('patch', { ascending: false });

  if (lifecycle && lifecycle.length > 0) {
    query = query.in('lifecycle', lifecycle);
  }

  const { data } = await query;
  return (data ?? []).map(mapRowToCapabilityVersion);
}

/**
 * Get all versions published by a specific agent.
 */
export async function listAgentVersions(agentId: string): Promise<CapabilityVersion[]> {
  const db = await getDb();
  if (!db) return [];

  const { data } = await db
    .from('a2a_capability_versions')
    .select('*')
    .eq('published_by_agent_id', agentId)
    .order('capability_id')
    .order('major', { ascending: false })
    .order('minor', { ascending: false })
    .order('patch', { ascending: false });

  return (data ?? []).map(mapRowToCapabilityVersion);
}

/**
 * Get a single version by ID.
 */
export async function getVersion(versionId: string): Promise<CapabilityVersion | null> {
  const db = await getDb();
  if (!db) return null;

  const { data } = await db
    .from('a2a_capability_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  return data ? mapRowToCapabilityVersion(data) : null;
}

// ──────────────────────────────────────────────
// Migration Path Registry
// ──────────────────────────────────────────────

/**
 * Register a migration path between two versions of a capability.
 */
export async function registerMigration(
  agentId: string,
  capabilityId: string,
  fromVersion: string,
  toVersion: string,
  bidirectional: boolean,
  inputTransforms: FieldTransform[],
  outputTransforms: FieldTransform[],
): Promise<MigrationPath> {
  // Validate versions exist
  if (!parseSemVer(fromVersion)) {
    throw new VersionError('INVALID_SEMVER', `"${fromVersion}" is not a valid semver.`);
  }
  if (!parseSemVer(toVersion)) {
    throw new VersionError('INVALID_SEMVER', `"${toVersion}" is not a valid semver.`);
  }

  const db = await getDb();
  if (!db) throw new VersionError('DB_UNAVAILABLE', 'Database not available.');

  // Check for duplicate migration
  const { data: existing } = await db
    .from('a2a_migration_paths')
    .select('id')
    .eq('capability_id', capabilityId)
    .eq('from_version', fromVersion)
    .eq('to_version', toVersion)
    .maybeSingle();

  if (existing) {
    throw new VersionError(
      'MIGRATION_EXISTS',
      `Migration path ${fromVersion} → ${toVersion} already exists for "${capabilityId}".`,
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await db
    .from('a2a_migration_paths')
    .insert({
      capability_id: capabilityId,
      from_version: fromVersion,
      to_version: toVersion,
      bidirectional,
      input_transforms: inputTransforms,
      output_transforms: outputTransforms,
      registered_by: agentId,
      validated: false,
      created_at: now,
    })
    .select()
    .single();

  if (error || !data) {
    throw new VersionError('REGISTER_FAILED', `Failed to register migration: ${error?.message}`);
  }

  return {
    id: data.id,
    capability_id: data.capability_id,
    from_version: data.from_version,
    to_version: data.to_version,
    bidirectional: data.bidirectional,
    input_transforms: data.input_transforms ?? [],
    output_transforms: data.output_transforms ?? [],
    registered_by: data.registered_by,
    validated: data.validated,
    created_at: data.created_at,
  };
}

/**
 * List migration paths for a capability.
 */
export async function listMigrations(capabilityId: string): Promise<MigrationPath[]> {
  const db = await getDb();
  if (!db) return [];

  const { data } = await db
    .from('a2a_migration_paths')
    .select('*')
    .eq('capability_id', capabilityId)
    .order('created_at', { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    capability_id: row.capability_id,
    from_version: row.from_version,
    to_version: row.to_version,
    bidirectional: row.bidirectional,
    input_transforms: row.input_transforms ?? [],
    output_transforms: row.output_transforms ?? [],
    registered_by: row.registered_by,
    validated: row.validated,
    created_at: row.created_at,
  }));
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Map a DB row to a CapabilityVersion. */
function mapRowToCapabilityVersion(row: Record<string, unknown>): CapabilityVersion {
  const version = row.version as string;
  const semver = parseSemVer(version)!;

  return {
    id: row.id as string,
    capability_id: row.capability_id as string,
    version,
    semver,
    lifecycle: row.lifecycle as VersionLifecycle,
    changelog: row.changelog as string,
    published_by_agent_id: row.published_by_agent_id as string,
    input_schema: (row.input_schema as Record<string, unknown>) ?? undefined,
    output_schema: (row.output_schema as Record<string, unknown>) ?? undefined,
    deprecated_at: (row.deprecated_at as string) ?? undefined,
    sunset_at: (row.sunset_at as string) ?? undefined,
    deprecation_message: (row.deprecation_message as string) ?? undefined,
    recommended_version: (row.recommended_version as string) ?? undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/** Get the service DB client. */
async function getDb() {
  const { getServiceDb } = await import('../auth');
  return getServiceDb();
}

// ──────────────────────────────────────────────
// Error Class
// ──────────────────────────────────────────────

export class VersionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'VersionError';
  }
}
