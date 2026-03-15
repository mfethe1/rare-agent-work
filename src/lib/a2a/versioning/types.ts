/**
 * Agent Capability Versioning & Semantic Protocol Negotiation — Types
 *
 * In a 2028 agent ecosystem, capabilities evolve constantly. Without versioning:
 * - Breaking changes crash dependent agents silently
 * - No gradual rollout or backward compatibility negotiation
 * - Contracts reference capabilities that may have changed semantics
 * - Workflows break when provider agents upgrade
 *
 * This module introduces semver-based capability versioning with:
 * - Deprecation lifecycle (active → deprecated → sunset → removed)
 * - Version negotiation protocol (agents agree on compatible versions)
 * - Migration paths between capability versions
 * - Compatibility matrices for the routing engine
 */

// ──────────────────────────────────────────────
// Semantic Version
// ──────────────────────────────────────────────

/** Parsed semantic version following semver 2.0.0. */
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  /** Optional pre-release tag (e.g., "alpha.1", "beta.2"). */
  prerelease?: string;
}

// ──────────────────────────────────────────────
// Capability Version Record
// ──────────────────────────────────────────────

/**
 * Deprecation lifecycle for capability versions.
 *
 * active     → Current, fully supported version
 * deprecated → Still functional but scheduled for removal; agents should migrate
 * sunset     → Grace period expired; platform may reject new contracts/tasks
 * removed    → No longer available; requests fail with VERSION_REMOVED
 */
export type VersionLifecycle = 'active' | 'deprecated' | 'sunset' | 'removed';

/** A versioned capability registered on the platform. */
export interface CapabilityVersion {
  /** Platform-assigned ID (UUID). */
  id: string;
  /** Base capability ID (e.g., "news.query"). */
  capability_id: string;
  /** Semver string (e.g., "2.1.0"). */
  version: string;
  /** Parsed semver components. */
  semver: SemVer;
  /** Current lifecycle state. */
  lifecycle: VersionLifecycle;
  /** Human-readable changelog for this version. */
  changelog: string;
  /** Agent that published this version. */
  published_by_agent_id: string;
  /** JSON Schema for the input this version accepts. */
  input_schema?: Record<string, unknown>;
  /** JSON Schema for the output this version produces. */
  output_schema?: Record<string, unknown>;
  /** When this version was deprecated (if applicable). */
  deprecated_at?: string;
  /** When this version enters sunset (if applicable). */
  sunset_at?: string;
  /** Message shown to agents using deprecated/sunset versions. */
  deprecation_message?: string;
  /** Recommended version to migrate to. */
  recommended_version?: string;
  /** ISO-8601 timestamps. */
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// Version Compatibility
// ──────────────────────────────────────────────

/**
 * Compatibility level between two versions.
 *
 * full       → Identical or patch-level difference; fully interchangeable
 * backward   → Minor version bump; consumer can use older version safely
 * negotiable → Major version bump but migration path exists
 * breaking   → Incompatible; no automatic migration possible
 */
export type CompatibilityLevel = 'full' | 'backward' | 'negotiable' | 'breaking';

/** Result of checking compatibility between two capability versions. */
export interface CompatibilityResult {
  /** The two versions being compared. */
  source_version: string;
  target_version: string;
  /** Computed compatibility level. */
  level: CompatibilityLevel;
  /** Whether the versions can interoperate (full, backward, or negotiable). */
  compatible: boolean;
  /** If negotiable, the migration path ID to use. */
  migration_path_id?: string;
  /** Human-readable explanation. */
  reason: string;
}

// ──────────────────────────────────────────────
// Migration Paths
// ──────────────────────────────────────────────

/**
 * A registered migration path between two versions of a capability.
 * Enables the platform to transform requests/responses between versions
 * so agents running different versions can still interoperate.
 */
export interface MigrationPath {
  /** Platform-assigned ID (UUID). */
  id: string;
  /** Base capability ID. */
  capability_id: string;
  /** Source version (semver string). */
  from_version: string;
  /** Target version (semver string). */
  to_version: string;
  /** Whether this migration is reversible (can transform in both directions). */
  bidirectional: boolean;
  /** JSONPath-based field mapping rules for input transformation. */
  input_transforms: FieldTransform[];
  /** JSONPath-based field mapping rules for output transformation. */
  output_transforms: FieldTransform[];
  /** Agent or system that registered this migration. */
  registered_by: string;
  /** Whether this migration has been validated by the platform. */
  validated: boolean;
  created_at: string;
}

/** A single field transformation rule for version migration. */
export interface FieldTransform {
  /** Operation to perform. */
  op: 'rename' | 'add' | 'remove' | 'map_value' | 'restructure';
  /** Source field path (dot-notation). */
  source_path?: string;
  /** Target field path (dot-notation). */
  target_path?: string;
  /** Default value for 'add' operations. */
  default_value?: unknown;
  /** Value mapping for 'map_value' operations. */
  value_map?: Record<string, unknown>;
  /** Description of what this transform does. */
  description: string;
}

// ──────────────────────────────────────────────
// Version Negotiation Protocol
// ──────────────────────────────────────────────

/**
 * Version negotiation allows two agents to agree on which version
 * of a capability to use for their interaction. The protocol:
 *
 * 1. Consumer sends supported version ranges
 * 2. Platform finds intersection with provider's published versions
 * 3. Best compatible version is selected (highest mutual version)
 * 4. If no direct match, platform checks for migration paths
 * 5. Negotiation result includes any required transforms
 */

/** Consumer's version preference for negotiation. */
export interface VersionConstraint {
  /** Capability being requested. */
  capability_id: string;
  /** Minimum acceptable version (inclusive). */
  min_version?: string;
  /** Maximum acceptable version (inclusive). */
  max_version?: string;
  /** Preferred version (if available). */
  preferred_version?: string;
  /** Whether to accept deprecated versions. */
  accept_deprecated?: boolean;
}

/** Result of version negotiation between two agents. */
export interface NegotiationResult {
  /** Whether negotiation succeeded. */
  success: boolean;
  /** The capability being negotiated. */
  capability_id: string;
  /** Consumer agent ID. */
  consumer_agent_id: string;
  /** Provider agent ID. */
  provider_agent_id: string;
  /** Version the consumer will use. */
  consumer_version?: string;
  /** Version the provider will use. */
  provider_version?: string;
  /** Whether a migration transform is needed. */
  requires_migration: boolean;
  /** Migration path to apply (if versions differ). */
  migration_path_id?: string;
  /** The agreed compatibility level. */
  compatibility_level?: CompatibilityLevel;
  /** Why negotiation failed (if success=false). */
  failure_reason?: string;
  /** All versions considered during negotiation. */
  versions_considered: string[];
}

// ──────────────────────────────────────────────
// Versioned Capability (extends AgentCapability)
// ──────────────────────────────────────────────

/** An agent capability with version information. */
export interface VersionedCapability {
  /** Machine-readable capability ID (e.g., "news.query"). */
  id: string;
  /** Semver version string (e.g., "2.1.0"). */
  version: string;
  /** Human-readable description. */
  description: string;
  /** Accepted input MIME types. */
  input_modes: string[];
  /** Produced output MIME types. */
  output_modes: string[];
  /** Input JSON Schema for this version. */
  input_schema?: Record<string, unknown>;
  /** Output JSON Schema for this version. */
  output_schema?: Record<string, unknown>;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/versions — publish a new capability version. */
export interface VersionPublishRequest {
  capability_id: string;
  version: string;
  changelog: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
}

export interface VersionPublishResponse {
  version_id: string;
  capability_id: string;
  version: string;
  lifecycle: VersionLifecycle;
  created_at: string;
}

/** PATCH /api/a2a/versions/:id/deprecate — deprecate a version. */
export interface VersionDeprecateRequest {
  /** When the version enters sunset (ISO-8601). */
  sunset_at: string;
  /** Message to show agents still using this version. */
  deprecation_message: string;
  /** Recommended version to migrate to. */
  recommended_version: string;
}

/** POST /api/a2a/versions/negotiate — negotiate versions between agents. */
export interface VersionNegotiateRequest {
  provider_agent_id: string;
  constraints: VersionConstraint[];
}

export interface VersionNegotiateResponse {
  results: NegotiationResult[];
  /** Overall success — true only if all capabilities were negotiated. */
  all_resolved: boolean;
}

/** POST /api/a2a/versions/migrations — register a migration path. */
export interface MigrationRegisterRequest {
  capability_id: string;
  from_version: string;
  to_version: string;
  bidirectional: boolean;
  input_transforms: FieldTransform[];
  output_transforms: FieldTransform[];
}

export interface MigrationRegisterResponse {
  migration_id: string;
  capability_id: string;
  from_version: string;
  to_version: string;
  validated: boolean;
  created_at: string;
}

/** GET /api/a2a/versions — list versions for a capability. */
export interface VersionListResponse {
  versions: CapabilityVersion[];
  count: number;
}

/** GET /api/a2a/versions/compatibility — check version compatibility. */
export interface CompatibilityCheckRequest {
  capability_id: string;
  source_version: string;
  target_version: string;
}
