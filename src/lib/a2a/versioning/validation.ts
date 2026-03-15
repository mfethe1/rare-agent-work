/**
 * Zod validation schemas for A2A Capability Versioning endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*)?$/;

const semverString = trimmed(64).regex(SEMVER_PATTERN, 'Must be a valid semver (e.g., "1.2.3" or "2.0.0-beta.1")');

// ──────────────────────────────────────────────
// Publish Version — POST /api/a2a/versions
// ──────────────────────────────────────────────

export const versionPublishSchema = z.object({
  capability_id: trimmed(128).min(1, 'Capability ID is required'),
  version: semverString,
  changelog: trimmed(5000).min(1, 'Changelog is required'),
  input_schema: z.record(z.string(), z.unknown()).optional(),
  output_schema: z.record(z.string(), z.unknown()).optional(),
});

export type VersionPublishInput = z.infer<typeof versionPublishSchema>;

// ──────────────────────────────────────────────
// Deprecate Version — PATCH /api/a2a/versions/:id/deprecate
// ──────────────────────────────────────────────

export const versionDeprecateSchema = z.object({
  sunset_at: z.string().datetime({ message: 'sunset_at must be a valid ISO-8601 datetime' }),
  deprecation_message: trimmed(2000).min(1, 'Deprecation message is required'),
  recommended_version: semverString,
});

export type VersionDeprecateInput = z.infer<typeof versionDeprecateSchema>;

// ──────────────────────────────────────────────
// Negotiate Versions — POST /api/a2a/versions/negotiate
// ──────────────────────────────────────────────

const versionConstraintSchema = z.object({
  capability_id: trimmed(128).min(1, 'Capability ID is required'),
  min_version: semverString.optional(),
  max_version: semverString.optional(),
  preferred_version: semverString.optional(),
  accept_deprecated: z.boolean().default(false),
});

export const versionNegotiateSchema = z.object({
  provider_agent_id: z.string().uuid('Provider agent ID must be a valid UUID'),
  constraints: z.array(versionConstraintSchema).min(1, 'At least one constraint is required').max(20),
});

export type VersionNegotiateInput = z.infer<typeof versionNegotiateSchema>;

// ──────────────────────────────────────────────
// Register Migration — POST /api/a2a/versions/migrations
// ──────────────────────────────────────────────

const fieldTransformSchema = z.object({
  op: z.enum(['rename', 'add', 'remove', 'map_value', 'restructure']),
  source_path: trimmed(256).optional(),
  target_path: trimmed(256).optional(),
  default_value: z.unknown().optional(),
  value_map: z.record(z.string(), z.unknown()).optional(),
  description: trimmed(500).min(1, 'Transform description is required'),
});

export const migrationRegisterSchema = z.object({
  capability_id: trimmed(128).min(1, 'Capability ID is required'),
  from_version: semverString,
  to_version: semverString,
  bidirectional: z.boolean().default(false),
  input_transforms: z.array(fieldTransformSchema).max(50).default([]),
  output_transforms: z.array(fieldTransformSchema).max(50).default([]),
});

export type MigrationRegisterInput = z.infer<typeof migrationRegisterSchema>;

// ──────────────────────────────────────────────
// Compatibility Check — GET /api/a2a/versions/compatibility
// ──────────────────────────────────────────────

export const compatibilityCheckSchema = z.object({
  capability_id: trimmed(128).min(1, 'Capability ID is required'),
  source_version: semverString,
  target_version: semverString,
});

export type CompatibilityCheckInput = z.infer<typeof compatibilityCheckSchema>;

// ──────────────────────────────────────────────
// List Versions — GET /api/a2a/versions
// ──────────────────────────────────────────────

export const versionListSchema = z.object({
  capability_id: trimmed(128).min(1, 'Capability ID is required'),
  lifecycle: z.array(z.enum(['active', 'deprecated', 'sunset', 'removed'])).optional(),
});

export type VersionListInput = z.infer<typeof versionListSchema>;
