/**
 * Version Negotiation Protocol
 *
 * Enables two agents to agree on which version of a capability to use.
 * The protocol resolves version mismatches through:
 *
 * 1. Direct match — both support same version
 * 2. Backward compatibility — same major, pick highest mutual minor
 * 3. Migration path — different majors but transform exists
 * 4. Failure — incompatible, no migration available
 *
 * This is critical for autonomous agent economies where providers
 * upgrade independently and consumers need graceful degradation.
 */

import type {
  VersionConstraint,
  NegotiationResult,
  CapabilityVersion,
  MigrationPath,
  CompatibilityLevel,
} from './types';
import { parseSemVer, compareSemVer, satisfiesRange, sortVersionsDescending } from './semver';

// ──────────────────────────────────────────────
// Core Negotiation
// ──────────────────────────────────────────────

/**
 * Negotiate the best version for a single capability between
 * a consumer's constraints and a provider's published versions.
 *
 * Strategy:
 * 1. Filter provider versions by lifecycle (active, optionally deprecated)
 * 2. Filter by consumer's version range constraints
 * 3. Pick highest mutually-compatible version
 * 4. If no direct match, check migration paths
 */
export function negotiateVersion(
  consumerAgentId: string,
  providerAgentId: string,
  constraint: VersionConstraint,
  providerVersions: CapabilityVersion[],
  migrationPaths: MigrationPath[],
): NegotiationResult {
  const capId = constraint.capability_id;

  // Filter to relevant provider versions for this capability
  const relevantVersions = providerVersions
    .filter((v) => v.capability_id === capId)
    .filter((v) => {
      if (v.lifecycle === 'active') return true;
      if (v.lifecycle === 'deprecated' && constraint.accept_deprecated) return true;
      return false;
    });

  if (relevantVersions.length === 0) {
    return {
      success: false,
      capability_id: capId,
      consumer_agent_id: consumerAgentId,
      provider_agent_id: providerAgentId,
      requires_migration: false,
      failure_reason: 'Provider has no active versions for this capability.',
      versions_considered: [],
    };
  }

  // Extract version strings and filter by consumer's range constraints
  const allVersionStrings = relevantVersions.map((v) => v.version);
  const inRangeVersions = allVersionStrings.filter((v) =>
    satisfiesRange(v, constraint.min_version, constraint.max_version),
  );

  // Try preferred version first
  if (constraint.preferred_version && inRangeVersions.includes(constraint.preferred_version)) {
    return {
      success: true,
      capability_id: capId,
      consumer_agent_id: consumerAgentId,
      provider_agent_id: providerAgentId,
      consumer_version: constraint.preferred_version,
      provider_version: constraint.preferred_version,
      requires_migration: false,
      compatibility_level: 'full',
      versions_considered: allVersionStrings,
    };
  }

  // Find highest in-range version
  if (inRangeVersions.length > 0) {
    const sorted = sortVersionsDescending(inRangeVersions);
    const best = sorted[0];
    return {
      success: true,
      capability_id: capId,
      consumer_agent_id: consumerAgentId,
      provider_agent_id: providerAgentId,
      consumer_version: best,
      provider_version: best,
      requires_migration: false,
      compatibility_level: 'full',
      versions_considered: allVersionStrings,
    };
  }

  // No direct match — try migration paths
  // Find the consumer's preferred or highest acceptable version
  const consumerPreferred = constraint.preferred_version ?? constraint.max_version ?? constraint.min_version;
  if (!consumerPreferred) {
    return {
      success: false,
      capability_id: capId,
      consumer_agent_id: consumerAgentId,
      provider_agent_id: providerAgentId,
      requires_migration: false,
      failure_reason: 'No versions in consumer\'s acceptable range and no version preference specified.',
      versions_considered: allVersionStrings,
    };
  }

  const migrationResult = findMigrationPath(
    capId,
    consumerPreferred,
    allVersionStrings,
    migrationPaths,
  );

  if (migrationResult) {
    return {
      success: true,
      capability_id: capId,
      consumer_agent_id: consumerAgentId,
      provider_agent_id: providerAgentId,
      consumer_version: consumerPreferred,
      provider_version: migrationResult.providerVersion,
      requires_migration: true,
      migration_path_id: migrationResult.migrationId,
      compatibility_level: 'negotiable',
      versions_considered: allVersionStrings,
    };
  }

  return {
    success: false,
    capability_id: capId,
    consumer_agent_id: consumerAgentId,
    provider_agent_id: providerAgentId,
    requires_migration: false,
    failure_reason: `No compatible version found. Consumer needs ~${consumerPreferred}, provider offers [${allVersionStrings.join(', ')}]. No migration path available.`,
    versions_considered: allVersionStrings,
  };
}

// ──────────────────────────────────────────────
// Migration Path Resolution
// ──────────────────────────────────────────────

interface MigrationMatch {
  providerVersion: string;
  migrationId: string;
}

/**
 * Find a migration path from the consumer's version to any of the
 * provider's available versions.
 *
 * Prefers:
 * 1. Direct migration to highest provider version
 * 2. Bidirectional migration from provider's version to consumer's
 */
function findMigrationPath(
  capabilityId: string,
  consumerVersion: string,
  providerVersions: string[],
  migrations: MigrationPath[],
): MigrationMatch | null {
  const capMigrations = migrations.filter((m) => m.capability_id === capabilityId);
  const sorted = sortVersionsDescending(providerVersions);

  for (const providerVersion of sorted) {
    // Forward migration: consumer → provider
    const forward = capMigrations.find(
      (m) => m.from_version === consumerVersion && m.to_version === providerVersion,
    );
    if (forward) {
      return { providerVersion, migrationId: forward.id };
    }

    // Bidirectional migration: provider → consumer (reversed)
    const reverse = capMigrations.find(
      (m) =>
        m.bidirectional &&
        m.from_version === providerVersion &&
        m.to_version === consumerVersion,
    );
    if (reverse) {
      return { providerVersion, migrationId: reverse.id };
    }
  }

  return null;
}

// ──────────────────────────────────────────────
// Batch Negotiation
// ──────────────────────────────────────────────

/**
 * Negotiate multiple capabilities at once between two agents.
 * Returns results for each capability and an overall success flag.
 */
export function negotiateBatch(
  consumerAgentId: string,
  providerAgentId: string,
  constraints: VersionConstraint[],
  providerVersions: CapabilityVersion[],
  migrationPaths: MigrationPath[],
): { results: NegotiationResult[]; all_resolved: boolean } {
  const results = constraints.map((constraint) =>
    negotiateVersion(consumerAgentId, providerAgentId, constraint, providerVersions, migrationPaths),
  );

  return {
    results,
    all_resolved: results.every((r) => r.success),
  };
}

// ──────────────────────────────────────────────
// Version Selection for Routing
// ──────────────────────────────────────────────

/**
 * For the routing engine: given a required capability with optional
 * version constraint, score how well a provider's versions match.
 *
 * Returns a version compatibility score (0-1) that the router can
 * blend into its composite scoring.
 *
 * Scoring:
 * - full compatibility    → 1.0
 * - backward compatible   → 0.85
 * - negotiable (migration)→ 0.5
 * - no version specified  → 0.7 (neutral — don't penalize unversioned)
 * - breaking              → 0.0
 */
export function scoreVersionCompatibility(
  requiredVersion: string | undefined,
  providerVersions: CapabilityVersion[],
  migrationPaths: MigrationPath[],
  capabilityId: string,
): { score: number; best_version: string | null; level: CompatibilityLevel | 'unversioned' } {
  if (!requiredVersion) {
    // No version constraint — find highest active version
    const active = providerVersions
      .filter((v) => v.capability_id === capabilityId && v.lifecycle === 'active');
    const best = active.length > 0
      ? sortVersionsDescending(active.map((v) => v.version))[0]
      : null;
    return { score: 0.7, best_version: best, level: 'unversioned' };
  }

  const reqSv = parseSemVer(requiredVersion);
  if (!reqSv) return { score: 0, best_version: null, level: 'breaking' };

  const activeVersions = providerVersions
    .filter((v) => v.capability_id === capabilityId && v.lifecycle === 'active');

  // Check for exact match
  const exact = activeVersions.find((v) => v.version === requiredVersion);
  if (exact) return { score: 1.0, best_version: exact.version, level: 'full' };

  // Check for backward-compatible versions (same major)
  const sameMajor = activeVersions
    .filter((v) => {
      const sv = parseSemVer(v.version);
      return sv && sv.major === reqSv.major;
    })
    .map((v) => v.version);

  if (sameMajor.length > 0) {
    const best = sortVersionsDescending(sameMajor)[0];
    return { score: 0.85, best_version: best, level: 'backward' };
  }

  // Check for migration paths
  const capMigrations = migrationPaths.filter((m) => m.capability_id === capabilityId);
  for (const av of activeVersions) {
    const hasPath = capMigrations.some(
      (m) =>
        (m.from_version === requiredVersion && m.to_version === av.version) ||
        (m.bidirectional && m.from_version === av.version && m.to_version === requiredVersion),
    );
    if (hasPath) {
      return { score: 0.5, best_version: av.version, level: 'negotiable' };
    }
  }

  return { score: 0, best_version: null, level: 'breaking' };
}
