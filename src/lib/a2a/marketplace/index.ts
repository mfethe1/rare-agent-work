/**
 * Agent Capability Marketplace & Package Registry
 *
 * The "npm for agents" — publish, discover, install, rate, and monetize
 * reusable capability packages in the rareagent.work ecosystem.
 */

// ── Types ──
export type {
  PackageLicense,
  PackageVisibility,
  PackageStatus,
  PackageCategory,
  PackagePricing,
  MarketplacePackage,
  PackageMetrics,
  PackageVersion,
  DependencySpec,
  InstallStatus,
  PackageInstallation,
  PackageReview,
  DependencyResolution,
  ResolvedDependency,
  DependencyConflict,
  QualityBreakdown,
  PublishPackageRequest,
  PublishPackageResponse,
  SearchPackagesRequest,
  SearchPackagesResponse,
  InstallPackageRequest,
  InstallPackageResponse,
  SubmitReviewRequest,
  SubmitReviewResponse,
  PackageDetailResponse,
  PublishVersionRequest,
  PublishVersionResponse,
  ResolveDepsRequest,
  ResolveDepsResponse,
  ListInstalledResponse,
  ListReviewsResponse,
  MarketplaceStatsResponse,
} from './types';

// ── Engine ──
export {
  computeQualityScore,
  QUALITY_WEIGHTS,
  publishPackage,
  searchPackages,
  getPackageDetail,
  installPackage,
  uninstallPackage,
  submitReview,
  listReviews,
  resolveDependencies,
  publishVersion,
  listInstalled,
  getMarketplaceStats,
} from './engine';
export type {
  PublishPackageParams,
  SearchParams,
  InstallParams,
  SubmitReviewParams,
  PublishVersionParams,
} from './engine';

// ── Validation ──
export {
  publishPackageSchema,
  searchPackagesSchema,
  installPackageSchema,
  uninstallPackageSchema,
  submitReviewSchema,
  publishVersionSchema,
  resolveDepsSchema,
  listInstalledSchema,
  listReviewsSchema,
} from './validation';
export type {
  PublishPackageInput,
  SearchPackagesInput,
  InstallPackageInput,
  UninstallPackageInput,
  SubmitReviewInput,
  PublishVersionInput,
  ResolveDepsInput,
  ListInstalledInput,
  ListReviewsInput,
} from './validation';
