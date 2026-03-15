/**
 * Agent Capability Marketplace & Package Registry — Types
 *
 * The "npm for agents" — a structured marketplace where agents publish,
 * discover, install, rate, and monetize reusable capability packages.
 *
 * In 2028, the winning A2A platform isn't the one with the best protocol —
 * it's the one with the richest ecosystem. Without a marketplace:
 * - Agents reinvent capabilities instead of composing existing ones
 * - No economic flywheel incentivizing quality capability production
 * - No trust signal beyond individual agent reputation
 * - No dependency resolution for complex multi-capability workflows
 * - Platform becomes a dumb pipe instead of an ecosystem hub
 *
 * This module introduces:
 * - Versioned capability packages with metadata, licensing, and pricing
 * - Semantic search and category-based discovery
 * - Install tracking with dependency resolution
 * - Quality scoring from reviews, usage metrics, and reliability data
 * - Revenue sharing between capability publishers and the platform
 */

// ──────────────────────────────────────────────
// Package Metadata
// ──────────────────────────────────────────────

/** License models for marketplace packages. */
export type PackageLicense =
  | 'open'           // Free, unrestricted use
  | 'attribution'    // Free with attribution requirement
  | 'non-commercial' // Free for non-commercial agents
  | 'per-call'       // Pay per invocation
  | 'subscription'   // Fixed recurring fee
  | 'enterprise';    // Custom licensing negotiated per-org

/** Package visibility in the marketplace. */
export type PackageVisibility = 'public' | 'unlisted' | 'private' | 'org-only';

/** Lifecycle status of a marketplace package. */
export type PackageStatus =
  | 'draft'       // Not yet published
  | 'in_review'   // Submitted for marketplace review
  | 'published'   // Live and discoverable
  | 'suspended'   // Temporarily removed (policy violation)
  | 'deprecated'  // Still installable but no longer maintained
  | 'archived';   // Removed from marketplace

/** Category taxonomy for marketplace discovery. */
export type PackageCategory =
  | 'data-retrieval'     // Fetching data from external sources
  | 'data-transformation'// Converting between formats
  | 'analysis'           // Statistical, ML, or reasoning analysis
  | 'generation'         // Content, code, or artifact generation
  | 'communication'      // Messaging, notification, email
  | 'integration'        // External API/service connectors
  | 'security'           // Auth, encryption, compliance
  | 'orchestration'      // Workflow and pipeline composition
  | 'monitoring'         // Observability, alerting, health checks
  | 'utility';           // General-purpose helpers

/** Pricing configuration for paid packages. */
export interface PackagePricing {
  /** License type. */
  license: PackageLicense;
  /** Cost per invocation in platform credits (for per-call). */
  per_call_credits?: number;
  /** Monthly subscription cost in platform credits. */
  monthly_credits?: number;
  /** Revenue share percentage to the platform (0-30). */
  platform_fee_percent: number;
  /** Free tier: number of free calls per month (0 = no free tier). */
  free_tier_calls: number;
}

/** A published capability package in the marketplace. */
export interface MarketplacePackage {
  /** Platform-assigned package ID (UUID). */
  id: string;
  /** Unique package name (scoped: @publisher/name). */
  name: string;
  /** Human-readable display name. */
  display_name: string;
  /** Package description (supports markdown). */
  description: string;
  /** Current published version (semver). */
  version: string;
  /** Agent ID of the publisher. */
  publisher_agent_id: string;
  /** Publisher display name (cached for performance). */
  publisher_name: string;
  /** Package lifecycle status. */
  status: PackageStatus;
  /** Marketplace visibility. */
  visibility: PackageVisibility;
  /** Primary category. */
  category: PackageCategory;
  /** Secondary tags for discovery. */
  tags: string[];
  /** Pricing configuration. */
  pricing: PackagePricing;
  /** Capability IDs this package provides. */
  capabilities: string[];
  /** Input JSON Schema. */
  input_schema?: Record<string, unknown>;
  /** Output JSON Schema. */
  output_schema?: Record<string, unknown>;
  /** Package IDs this package depends on. */
  dependencies: string[];
  /** Minimum platform SDK version required. */
  min_sdk_version?: string;
  /** Quality score (0-100, computed from reviews + usage). */
  quality_score: number;
  /** Aggregate metrics. */
  metrics: PackageMetrics;
  /** ISO-8601 timestamps. */
  created_at: string;
  updated_at: string;
  published_at?: string;
  deprecated_at?: string;
}

/** Aggregate usage and quality metrics for a package. */
export interface PackageMetrics {
  /** Total installations across all agents. */
  total_installs: number;
  /** Currently active installations. */
  active_installs: number;
  /** Total invocations across all installers. */
  total_invocations: number;
  /** Average response time in ms (last 30 days). */
  avg_latency_ms: number;
  /** Success rate (0-1, last 30 days). */
  success_rate: number;
  /** Average review rating (1-5). */
  avg_rating: number;
  /** Total number of reviews. */
  review_count: number;
  /** Revenue generated in platform credits (lifetime). */
  total_revenue_credits: number;
}

// ──────────────────────────────────────────────
// Package Versions
// ──────────────────────────────────────────────

/** A specific version release of a package. */
export interface PackageVersion {
  /** Platform-assigned version record ID (UUID). */
  id: string;
  /** Parent package ID. */
  package_id: string;
  /** Semver string. */
  version: string;
  /** Changelog for this version (markdown). */
  changelog: string;
  /** Input schema for this version. */
  input_schema?: Record<string, unknown>;
  /** Output schema for this version. */
  output_schema?: Record<string, unknown>;
  /** Dependencies with version constraints. */
  dependencies: DependencySpec[];
  /** Whether this version passed automated compatibility checks. */
  verified: boolean;
  /** Download/install count for this specific version. */
  install_count: number;
  created_at: string;
}

/** A dependency specification with version constraint. */
export interface DependencySpec {
  /** Package name (@publisher/name). */
  package_name: string;
  /** Semver range constraint (e.g., "^2.0.0", ">=1.5.0 <3.0.0"). */
  version_range: string;
  /** Whether this dependency is required or optional. */
  optional: boolean;
}

// ──────────────────────────────────────────────
// Installations
// ──────────────────────────────────────────────

/** Installation status. */
export type InstallStatus = 'active' | 'suspended' | 'uninstalled';

/** Record of an agent installing a marketplace package. */
export interface PackageInstallation {
  /** Platform-assigned installation ID (UUID). */
  id: string;
  /** Package being installed. */
  package_id: string;
  /** Package name (cached). */
  package_name: string;
  /** Version installed. */
  installed_version: string;
  /** Agent that installed the package. */
  agent_id: string;
  /** Installation status. */
  status: InstallStatus;
  /** Per-agent invocation count. */
  invocation_count: number;
  /** Last time this agent invoked the package. */
  last_invoked_at?: string;
  /** Auto-update: track latest compatible version. */
  auto_update: boolean;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// Reviews & Ratings
// ──────────────────────────────────────────────

/** A review left by an agent for an installed package. */
export interface PackageReview {
  /** Platform-assigned review ID (UUID). */
  id: string;
  /** Package being reviewed. */
  package_id: string;
  /** Agent leaving the review. */
  reviewer_agent_id: string;
  /** Reviewer display name (cached). */
  reviewer_name: string;
  /** Star rating (1-5). */
  rating: number;
  /** Review title. */
  title: string;
  /** Review body (markdown). */
  body: string;
  /** Verified: reviewer has actually installed and used the package. */
  verified_usage: boolean;
  /** Number of invocations at time of review. */
  usage_count_at_review: number;
  /** Upvotes from other agents. */
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// Dependency Resolution
// ──────────────────────────────────────────────

/** Result of resolving a dependency tree. */
export interface DependencyResolution {
  /** Whether all dependencies were resolved successfully. */
  resolved: boolean;
  /** Flat list of all packages needed (topologically sorted). */
  install_order: ResolvedDependency[];
  /** Conflicts that prevented resolution. */
  conflicts: DependencyConflict[];
}

/** A single resolved dependency in the install plan. */
export interface ResolvedDependency {
  /** Package name. */
  package_name: string;
  /** Package ID. */
  package_id: string;
  /** Resolved version. */
  version: string;
  /** Whether this is a direct or transitive dependency. */
  direct: boolean;
  /** Already installed (no action needed). */
  already_installed: boolean;
}

/** A dependency conflict that blocks resolution. */
export interface DependencyConflict {
  /** Package name with the conflict. */
  package_name: string;
  /** Conflicting version requirements. */
  required_by: Array<{ package_name: string; version_range: string }>;
  /** Why the conflict is unresolvable. */
  reason: string;
}

// ──────────────────────────────────────────────
// Quality Scoring
// ──────────────────────────────────────────────

/** Breakdown of how quality score is computed. */
export interface QualityBreakdown {
  /** Weighted average of review ratings (0-25). */
  review_score: number;
  /** Based on success rate and latency (0-25). */
  reliability_score: number;
  /** Based on install count and growth trend (0-25). */
  popularity_score: number;
  /** Based on update frequency and responsiveness (0-25). */
  maintenance_score: number;
  /** Final composite (0-100). */
  total: number;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/marketplace/packages — publish a new package. */
export interface PublishPackageRequest {
  name: string;
  display_name: string;
  description: string;
  version: string;
  category: PackageCategory;
  tags?: string[];
  visibility?: PackageVisibility;
  pricing: PackagePricing;
  capabilities: string[];
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  dependencies?: DependencySpec[];
  min_sdk_version?: string;
  changelog?: string;
}

export interface PublishPackageResponse {
  package_id: string;
  name: string;
  version: string;
  status: PackageStatus;
  created_at: string;
}

/** GET /api/a2a/marketplace/packages — search packages. */
export interface SearchPackagesRequest {
  query?: string;
  category?: PackageCategory;
  tags?: string[];
  license?: PackageLicense;
  min_rating?: number;
  sort_by?: 'relevance' | 'quality' | 'installs' | 'rating' | 'newest';
  limit?: number;
  offset?: number;
}

export interface SearchPackagesResponse {
  packages: MarketplacePackage[];
  total: number;
  limit: number;
  offset: number;
}

/** POST /api/a2a/marketplace/packages/:id/install — install a package. */
export interface InstallPackageRequest {
  version?: string;
  auto_update?: boolean;
  resolve_dependencies?: boolean;
}

export interface InstallPackageResponse {
  installation_id: string;
  package_id: string;
  package_name: string;
  installed_version: string;
  dependencies_installed: ResolvedDependency[];
  created_at: string;
}

/** POST /api/a2a/marketplace/packages/:id/reviews — leave a review. */
export interface SubmitReviewRequest {
  rating: number;
  title: string;
  body: string;
}

export interface SubmitReviewResponse {
  review_id: string;
  package_id: string;
  rating: number;
  verified_usage: boolean;
  created_at: string;
}

/** GET /api/a2a/marketplace/packages/:id — package detail. */
export interface PackageDetailResponse {
  package: MarketplacePackage;
  versions: PackageVersion[];
  recent_reviews: PackageReview[];
  quality_breakdown: QualityBreakdown;
}

/** POST /api/a2a/marketplace/packages/:id/versions — publish new version. */
export interface PublishVersionRequest {
  version: string;
  changelog: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  dependencies?: DependencySpec[];
}

export interface PublishVersionResponse {
  version_id: string;
  package_id: string;
  version: string;
  verified: boolean;
  created_at: string;
}

/** POST /api/a2a/marketplace/resolve — resolve dependency tree. */
export interface ResolveDepsRequest {
  package_name: string;
  version?: string;
}

export interface ResolveDepsResponse {
  resolution: DependencyResolution;
}

/** GET /api/a2a/marketplace/installed — list installed packages. */
export interface ListInstalledResponse {
  installations: PackageInstallation[];
  count: number;
}

/** GET /api/a2a/marketplace/packages/:id/reviews — list reviews. */
export interface ListReviewsResponse {
  reviews: PackageReview[];
  total: number;
}

/** GET /api/a2a/marketplace/stats — marketplace-wide stats. */
export interface MarketplaceStatsResponse {
  total_packages: number;
  total_installs: number;
  total_invocations: number;
  total_revenue_credits: number;
  top_categories: Array<{ category: PackageCategory; count: number }>;
  top_packages: Array<{ name: string; quality_score: number; installs: number }>;
}
