/**
 * Agent Capability Versioning & Semantic Protocol Negotiation
 *
 * Barrel export for the versioning subsystem.
 */

// Types
export type {
  SemVer,
  VersionLifecycle,
  CapabilityVersion,
  CompatibilityLevel,
  CompatibilityResult,
  MigrationPath,
  FieldTransform,
  VersionConstraint,
  NegotiationResult,
  VersionedCapability,
  VersionPublishRequest,
  VersionPublishResponse,
  VersionDeprecateRequest,
  VersionNegotiateRequest,
  VersionNegotiateResponse,
  MigrationRegisterRequest,
  MigrationRegisterResponse,
  VersionListResponse,
  CompatibilityCheckRequest,
} from './types';

// Semver utilities
export {
  parseSemVer,
  formatSemVer,
  isValidSemVer,
  compareSemVer,
  compareSemVerStrings,
  checkCompatibility,
  satisfiesRange,
  sortVersionsDescending,
  findBestVersion,
} from './semver';

// Negotiation protocol
export {
  negotiateVersion,
  negotiateBatch,
  scoreVersionCompatibility,
} from './negotiation';

// Version registry & lifecycle
export {
  publishVersion,
  deprecateVersion,
  enforceSunsets,
  removeVersion,
  listVersions,
  listAgentVersions,
  getVersion,
  registerMigration,
  listMigrations,
  VersionError,
} from './registry';
