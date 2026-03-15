/**
 * Semantic Versioning Utilities for A2A Capability Versioning
 *
 * Implements semver 2.0.0 parsing, comparison, and compatibility
 * checking tailored for agent capability evolution.
 *
 * Compatibility rules:
 * - Same major version → backward compatible (minor/patch differences)
 * - Different major version → breaking change (requires migration path)
 * - Pre-release versions → only compatible with exact match
 */

import type { SemVer, CompatibilityLevel, CompatibilityResult } from './types';

// ──────────────────────────────────────────────
// Parsing
// ──────────────────────────────────────────────

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*))?$/;

/**
 * Parse a semver string into structured components.
 * Returns null if the string is not a valid semver.
 */
export function parseSemVer(version: string): SemVer | null {
  const match = version.trim().match(SEMVER_RE);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || undefined,
  };
}

/**
 * Format a SemVer back to a string.
 */
export function formatSemVer(sv: SemVer): string {
  const base = `${sv.major}.${sv.minor}.${sv.patch}`;
  return sv.prerelease ? `${base}-${sv.prerelease}` : base;
}

/**
 * Validate that a string is a valid semver.
 */
export function isValidSemVer(version: string): boolean {
  return SEMVER_RE.test(version.trim());
}

// ──────────────────────────────────────────────
// Comparison
// ──────────────────────────────────────────────

/**
 * Compare two semver values.
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b.
 */
export function compareSemVer(a: SemVer, b: SemVer): -1 | 0 | 1 {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;

  // Pre-release versions have lower precedence than release
  if (a.prerelease && !b.prerelease) return -1;
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && b.prerelease) {
    return a.prerelease < b.prerelease ? -1 : a.prerelease > b.prerelease ? 1 : 0;
  }

  return 0;
}

/**
 * Compare two semver strings. Returns -1, 0, or 1.
 * Throws if either string is not valid semver.
 */
export function compareSemVerStrings(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemVer(a);
  const pb = parseSemVer(b);
  if (!pa) throw new Error(`Invalid semver: ${a}`);
  if (!pb) throw new Error(`Invalid semver: ${b}`);
  return compareSemVer(pa, pb);
}

// ──────────────────────────────────────────────
// Compatibility Checking
// ──────────────────────────────────────────────

/**
 * Determine the compatibility level between two versions.
 *
 * Rules:
 * - Same major.minor.patch → full
 * - Same major, different minor/patch → backward
 * - Different major → breaking (unless migration path exists, then negotiable)
 * - Pre-release → only full-compatible with exact match
 */
export function checkCompatibility(
  source: string,
  target: string,
  hasMigrationPath: boolean = false,
): CompatibilityResult {
  const sv = parseSemVer(source);
  const tv = parseSemVer(target);

  if (!sv || !tv) {
    return {
      source_version: source,
      target_version: target,
      level: 'breaking',
      compatible: false,
      reason: `Invalid semver: ${!sv ? source : target}`,
    };
  }

  // Pre-release: exact match only
  if (sv.prerelease || tv.prerelease) {
    const exact = compareSemVer(sv, tv) === 0;
    return {
      source_version: source,
      target_version: target,
      level: exact ? 'full' : 'breaking',
      compatible: exact,
      reason: exact
        ? 'Pre-release versions match exactly.'
        : 'Pre-release versions are only compatible with exact matches.',
    };
  }

  // Exact match
  if (compareSemVer(sv, tv) === 0) {
    return {
      source_version: source,
      target_version: target,
      level: 'full',
      compatible: true,
      reason: 'Identical versions.',
    };
  }

  // Same major version — backward compatible
  if (sv.major === tv.major) {
    return {
      source_version: source,
      target_version: target,
      level: 'backward',
      compatible: true,
      reason: `Same major version (${sv.major}). Minor/patch differences are backward compatible.`,
    };
  }

  // Different major version — breaking unless migration exists
  if (hasMigrationPath) {
    return {
      source_version: source,
      target_version: target,
      level: 'negotiable',
      compatible: true,
      reason: `Major version change (${sv.major} → ${tv.major}). Migration path available.`,
    };
  }

  return {
    source_version: source,
    target_version: target,
    level: 'breaking',
    compatible: false,
    reason: `Major version change (${sv.major} → ${tv.major}). No migration path registered.`,
  };
}

// ──────────────────────────────────────────────
// Version Range Filtering
// ──────────────────────────────────────────────

/**
 * Check if a version satisfies a version range constraint.
 */
export function satisfiesRange(
  version: string,
  minVersion?: string,
  maxVersion?: string,
): boolean {
  const sv = parseSemVer(version);
  if (!sv) return false;

  if (minVersion) {
    const min = parseSemVer(minVersion);
    if (min && compareSemVer(sv, min) < 0) return false;
  }

  if (maxVersion) {
    const max = parseSemVer(maxVersion);
    if (max && compareSemVer(sv, max) > 0) return false;
  }

  return true;
}

/**
 * Sort version strings in descending order (highest first).
 */
export function sortVersionsDescending(versions: string[]): string[] {
  return [...versions].sort((a, b) => compareSemVerStrings(b, a));
}

/**
 * Find the highest version from a list that satisfies constraints.
 */
export function findBestVersion(
  versions: string[],
  minVersion?: string,
  maxVersion?: string,
  preferred?: string,
): string | null {
  // If preferred version is available and satisfies range, use it
  if (preferred && versions.includes(preferred) && satisfiesRange(preferred, minVersion, maxVersion)) {
    return preferred;
  }

  // Otherwise pick the highest version in range
  const sorted = sortVersionsDescending(versions);
  return sorted.find((v) => satisfiesRange(v, minVersion, maxVersion)) ?? null;
}
