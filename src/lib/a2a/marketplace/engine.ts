/**
 * Agent Capability Marketplace — Engine
 *
 * Core logic for publishing, searching, installing, reviewing,
 * and resolving dependencies for marketplace capability packages.
 */

import { getServiceDb } from '../auth';
import type {
  MarketplacePackage,
  PackageVersion,
  PackageInstallation,
  PackageReview,
  PackageMetrics,
  PackagePricing,
  PackageStatus,
  PackageCategory,
  PackageLicense,
  PackageVisibility,
  DependencySpec,
  DependencyResolution,
  ResolvedDependency,
  DependencyConflict,
  QualityBreakdown,
} from './types';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const DEFAULT_METRICS: PackageMetrics = {
  total_installs: 0,
  active_installs: 0,
  total_invocations: 0,
  avg_latency_ms: 0,
  success_rate: 1,
  avg_rating: 0,
  review_count: 0,
  total_revenue_credits: 0,
};

/** Quality score weights (must sum to 100). */
export const QUALITY_WEIGHTS = {
  review: 25,
  reliability: 25,
  popularity: 25,
  maintenance: 25,
} as const;

// ──────────────────────────────────────────────
// Quality Scoring
// ──────────────────────────────────────────────

/**
 * Compute quality score breakdown for a package.
 * Each component is 0-25, total is 0-100.
 */
export function computeQualityScore(
  metrics: PackageMetrics,
  daysSinceUpdate: number,
): QualityBreakdown {
  // Review score: weighted by count (more reviews → more reliable signal)
  const reviewConfidence = Math.min(metrics.review_count / 10, 1);
  const normalizedRating = metrics.avg_rating > 0 ? (metrics.avg_rating - 1) / 4 : 0;
  const review_score = Math.round(normalizedRating * reviewConfidence * QUALITY_WEIGHTS.review);

  // Reliability score: success rate and latency
  const latencyPenalty = Math.max(0, 1 - metrics.avg_latency_ms / 10000);
  const reliability_score = Math.round(
    ((metrics.success_rate * 0.7 + latencyPenalty * 0.3) * QUALITY_WEIGHTS.reliability),
  );

  // Popularity score: logarithmic scale of installs
  const installScore = metrics.total_installs > 0
    ? Math.min(Math.log10(metrics.total_installs) / 4, 1)
    : 0;
  const popularity_score = Math.round(installScore * QUALITY_WEIGHTS.popularity);

  // Maintenance score: penalize stale packages
  const freshness = Math.max(0, 1 - daysSinceUpdate / 365);
  const maintenance_score = Math.round(freshness * QUALITY_WEIGHTS.maintenance);

  const total = review_score + reliability_score + popularity_score + maintenance_score;

  return { review_score, reliability_score, popularity_score, maintenance_score, total };
}

// ──────────────────────────────────────────────
// Package Publishing
// ──────────────────────────────────────────────

export interface PublishPackageParams {
  name: string;
  display_name: string;
  description: string;
  version: string;
  publisher_agent_id: string;
  publisher_name: string;
  category: PackageCategory;
  tags: string[];
  visibility: PackageVisibility;
  pricing: PackagePricing;
  capabilities: string[];
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  dependencies: DependencySpec[];
  min_sdk_version?: string;
  changelog?: string;
}

export async function publishPackage(params: PublishPackageParams): Promise<MarketplacePackage> {
  const db = getServiceDb();

  // Check for name uniqueness
  const { data: existing } = await db
    .from('a2a_marketplace_packages')
    .select('id')
    .eq('name', params.name)
    .maybeSingle();

  if (existing) {
    throw new Error(`Package name "${params.name}" is already taken`);
  }

  const now = new Date().toISOString();
  const pkg: Omit<MarketplacePackage, 'id'> = {
    name: params.name,
    display_name: params.display_name,
    description: params.description,
    version: params.version,
    publisher_agent_id: params.publisher_agent_id,
    publisher_name: params.publisher_name,
    status: 'published' as PackageStatus,
    visibility: params.visibility,
    category: params.category,
    tags: params.tags,
    pricing: params.pricing,
    capabilities: params.capabilities,
    input_schema: params.input_schema,
    output_schema: params.output_schema,
    dependencies: params.dependencies.map((d) => d.package_name),
    min_sdk_version: params.min_sdk_version,
    quality_score: 0,
    metrics: DEFAULT_METRICS,
    created_at: now,
    updated_at: now,
    published_at: now,
  };

  const { data, error } = await db
    .from('a2a_marketplace_packages')
    .insert(pkg)
    .select()
    .single();

  if (error) throw new Error(`Failed to publish package: ${error.message}`);

  // Create initial version record
  await db.from('a2a_marketplace_versions').insert({
    package_id: data.id,
    version: params.version,
    changelog: params.changelog ?? 'Initial release',
    input_schema: params.input_schema,
    output_schema: params.output_schema,
    dependencies: params.dependencies,
    verified: false,
    install_count: 0,
    created_at: now,
  });

  return data as MarketplacePackage;
}

// ──────────────────────────────────────────────
// Package Search
// ──────────────────────────────────────────────

export interface SearchParams {
  query?: string;
  category?: PackageCategory;
  tags?: string[];
  license?: PackageLicense;
  min_rating?: number;
  sort_by: 'relevance' | 'quality' | 'installs' | 'rating' | 'newest';
  limit: number;
  offset: number;
}

export async function searchPackages(
  params: SearchParams,
): Promise<{ packages: MarketplacePackage[]; total: number }> {
  const db = getServiceDb();

  let query = db
    .from('a2a_marketplace_packages')
    .select('*', { count: 'exact' })
    .eq('status', 'published')
    .eq('visibility', 'public');

  if (params.category) {
    query = query.eq('category', params.category);
  }

  if (params.min_rating) {
    query = query.gte('quality_score', params.min_rating * 20);
  }

  if (params.query) {
    query = query.or(
      `name.ilike.%${params.query}%,display_name.ilike.%${params.query}%,description.ilike.%${params.query}%`,
    );
  }

  // Sort
  switch (params.sort_by) {
    case 'quality':
      query = query.order('quality_score', { ascending: false });
      break;
    case 'installs':
      query = query.order('metrics->total_installs', { ascending: false });
      break;
    case 'rating':
      query = query.order('metrics->avg_rating', { ascending: false });
      break;
    case 'newest':
      query = query.order('published_at', { ascending: false });
      break;
    default: // relevance — quality + recency blend
      query = query.order('quality_score', { ascending: false });
  }

  query = query.range(params.offset, params.offset + params.limit - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(`Search failed: ${error.message}`);

  return { packages: (data ?? []) as MarketplacePackage[], total: count ?? 0 };
}

// ──────────────────────────────────────────────
// Package Detail
// ──────────────────────────────────────────────

export async function getPackageDetail(packageId: string): Promise<{
  package: MarketplacePackage;
  versions: PackageVersion[];
  recent_reviews: PackageReview[];
  quality_breakdown: QualityBreakdown;
} | null> {
  const db = getServiceDb();

  const { data: pkg } = await db
    .from('a2a_marketplace_packages')
    .select('*')
    .eq('id', packageId)
    .maybeSingle();

  if (!pkg) return null;

  const [versionsResult, reviewsResult] = await Promise.all([
    db.from('a2a_marketplace_versions')
      .select('*')
      .eq('package_id', packageId)
      .order('created_at', { ascending: false })
      .limit(10),
    db.from('a2a_marketplace_reviews')
      .select('*')
      .eq('package_id', packageId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(pkg.updated_at).getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    package: pkg as MarketplacePackage,
    versions: (versionsResult.data ?? []) as PackageVersion[],
    recent_reviews: (reviewsResult.data ?? []) as PackageReview[],
    quality_breakdown: computeQualityScore(pkg.metrics as PackageMetrics, daysSinceUpdate),
  };
}

// ──────────────────────────────────────────────
// Package Installation
// ──────────────────────────────────────────────

export interface InstallParams {
  package_id: string;
  agent_id: string;
  version?: string;
  auto_update: boolean;
  resolve_dependencies: boolean;
}

export async function installPackage(params: InstallParams): Promise<{
  installation: PackageInstallation;
  dependencies_installed: ResolvedDependency[];
}> {
  const db = getServiceDb();

  // Get the package
  const { data: pkg } = await db
    .from('a2a_marketplace_packages')
    .select('*')
    .eq('id', params.package_id)
    .single();

  if (!pkg) throw new Error('Package not found');
  if (pkg.status !== 'published' && pkg.status !== 'deprecated') {
    throw new Error(`Cannot install package with status: ${pkg.status}`);
  }

  // Check for existing installation
  const { data: existing } = await db
    .from('a2a_marketplace_installations')
    .select('id')
    .eq('package_id', params.package_id)
    .eq('agent_id', params.agent_id)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) throw new Error('Package already installed');

  const version = params.version ?? pkg.version;
  const now = new Date().toISOString();

  // Resolve dependencies if requested
  let depsInstalled: ResolvedDependency[] = [];
  if (params.resolve_dependencies && pkg.dependencies?.length > 0) {
    const resolution = await resolveDependencies(pkg.name, version, params.agent_id);
    if (!resolution.resolved) {
      const reasons = resolution.conflicts.map((c) => c.reason).join('; ');
      throw new Error(`Dependency resolution failed: ${reasons}`);
    }
    depsInstalled = resolution.install_order.filter((d) => !d.direct && !d.already_installed);
  }

  // Create installation record
  const { data: installation, error } = await db
    .from('a2a_marketplace_installations')
    .insert({
      package_id: params.package_id,
      package_name: pkg.name,
      installed_version: version,
      agent_id: params.agent_id,
      status: 'active',
      invocation_count: 0,
      auto_update: params.auto_update,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(`Install failed: ${error.message}`);

  // Increment install counts
  await db.rpc('increment_marketplace_installs', { p_package_id: params.package_id });

  return {
    installation: installation as PackageInstallation,
    dependencies_installed: depsInstalled,
  };
}

// ──────────────────────────────────────────────
// Uninstall
// ──────────────────────────────────────────────

export async function uninstallPackage(packageId: string, agentId: string): Promise<void> {
  const db = getServiceDb();

  const { error } = await db
    .from('a2a_marketplace_installations')
    .update({ status: 'uninstalled', updated_at: new Date().toISOString() })
    .eq('package_id', packageId)
    .eq('agent_id', agentId)
    .eq('status', 'active');

  if (error) throw new Error(`Uninstall failed: ${error.message}`);

  // Decrement active installs
  await db.rpc('decrement_marketplace_installs', { p_package_id: packageId });
}

// ──────────────────────────────────────────────
// Reviews
// ──────────────────────────────────────────────

export interface SubmitReviewParams {
  package_id: string;
  reviewer_agent_id: string;
  reviewer_name: string;
  rating: number;
  title: string;
  body: string;
}

export async function submitReview(params: SubmitReviewParams): Promise<PackageReview> {
  const db = getServiceDb();

  // Verify the reviewer has installed the package
  const { data: installation } = await db
    .from('a2a_marketplace_installations')
    .select('invocation_count')
    .eq('package_id', params.package_id)
    .eq('agent_id', params.reviewer_agent_id)
    .maybeSingle();

  const verified = !!installation;
  const usageCount = installation?.invocation_count ?? 0;

  // Check for existing review
  const { data: existing } = await db
    .from('a2a_marketplace_reviews')
    .select('id')
    .eq('package_id', params.package_id)
    .eq('reviewer_agent_id', params.reviewer_agent_id)
    .maybeSingle();

  if (existing) throw new Error('You have already reviewed this package');

  const now = new Date().toISOString();
  const { data, error } = await db
    .from('a2a_marketplace_reviews')
    .insert({
      package_id: params.package_id,
      reviewer_agent_id: params.reviewer_agent_id,
      reviewer_name: params.reviewer_name,
      rating: params.rating,
      title: params.title,
      body: params.body,
      verified_usage: verified,
      usage_count_at_review: usageCount,
      helpful_count: 0,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(`Review submission failed: ${error.message}`);

  // Update package metrics with new average rating
  await updatePackageRating(params.package_id);

  return data as PackageReview;
}

async function updatePackageRating(packageId: string): Promise<void> {
  const db = getServiceDb();

  const { data: reviews } = await db
    .from('a2a_marketplace_reviews')
    .select('rating')
    .eq('package_id', packageId);

  if (!reviews || reviews.length === 0) return;

  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  // Update metrics in the package record
  await db.rpc('update_marketplace_rating', {
    p_package_id: packageId,
    p_avg_rating: Math.round(avg * 100) / 100,
    p_review_count: reviews.length,
  });
}

export async function listReviews(
  packageId: string,
  sortBy: 'newest' | 'highest' | 'lowest' | 'helpful',
  limit: number,
  offset: number,
): Promise<{ reviews: PackageReview[]; total: number }> {
  const db = getServiceDb();

  let query = db
    .from('a2a_marketplace_reviews')
    .select('*', { count: 'exact' })
    .eq('package_id', packageId);

  switch (sortBy) {
    case 'highest':
      query = query.order('rating', { ascending: false });
      break;
    case 'lowest':
      query = query.order('rating', { ascending: true });
      break;
    case 'helpful':
      query = query.order('helpful_count', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(`Failed to list reviews: ${error.message}`);

  return { reviews: (data ?? []) as PackageReview[], total: count ?? 0 };
}

// ──────────────────────────────────────────────
// Dependency Resolution
// ──────────────────────────────────────────────

/**
 * Resolve the full dependency tree for a package.
 * Uses a simple breadth-first approach with conflict detection.
 */
export async function resolveDependencies(
  packageName: string,
  version: string | undefined,
  agentId: string,
): Promise<DependencyResolution> {
  const db = getServiceDb();

  // Get the root package
  const { data: rootPkg } = await db
    .from('a2a_marketplace_packages')
    .select('*')
    .eq('name', packageName)
    .eq('status', 'published')
    .maybeSingle();

  if (!rootPkg) {
    return {
      resolved: false,
      install_order: [],
      conflicts: [{ package_name: packageName, required_by: [], reason: 'Package not found' }],
    };
  }

  // Get existing installations for this agent
  const { data: existingInstalls } = await db
    .from('a2a_marketplace_installations')
    .select('package_name, installed_version')
    .eq('agent_id', agentId)
    .eq('status', 'active');

  const installed = new Map(
    (existingInstalls ?? []).map((i: { package_name: string; installed_version: string }) => [
      i.package_name, i.installed_version,
    ]),
  );

  const installOrder: ResolvedDependency[] = [];
  const resolved = new Set<string>();
  const conflicts: DependencyConflict[] = [];

  // BFS through dependency tree
  const queue: Array<{ name: string; deps: DependencySpec[]; direct: boolean }> = [
    { name: rootPkg.name, deps: (rootPkg as MarketplacePackage).dependencies?.length
      ? await getPackageDeps(rootPkg.id) : [], direct: true },
  ];

  // Add root package
  installOrder.push({
    package_name: rootPkg.name,
    package_id: rootPkg.id,
    version: version ?? rootPkg.version,
    direct: true,
    already_installed: installed.has(rootPkg.name),
  });
  resolved.add(rootPkg.name);

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const dep of current.deps) {
      if (resolved.has(dep.package_name)) continue;
      resolved.add(dep.package_name);

      const { data: depPkg } = await db
        .from('a2a_marketplace_packages')
        .select('*')
        .eq('name', dep.package_name)
        .eq('status', 'published')
        .maybeSingle();

      if (!depPkg) {
        if (!dep.optional) {
          conflicts.push({
            package_name: dep.package_name,
            required_by: [{ package_name: current.name, version_range: dep.version_range }],
            reason: `Required dependency "${dep.package_name}" not found in marketplace`,
          });
        }
        continue;
      }

      installOrder.push({
        package_name: depPkg.name,
        package_id: depPkg.id,
        version: depPkg.version,
        direct: false,
        already_installed: installed.has(depPkg.name),
      });

      // Recurse into transitive deps
      const transitiveDeps = await getPackageDeps(depPkg.id);
      if (transitiveDeps.length > 0) {
        queue.push({ name: depPkg.name, deps: transitiveDeps, direct: false });
      }
    }
  }

  return {
    resolved: conflicts.length === 0,
    install_order: installOrder,
    conflicts,
  };
}

async function getPackageDeps(packageId: string): Promise<DependencySpec[]> {
  const db = getServiceDb();
  const { data } = await db
    .from('a2a_marketplace_versions')
    .select('dependencies')
    .eq('package_id', packageId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.dependencies as DependencySpec[]) ?? [];
}

// ──────────────────────────────────────────────
// Package Version Publishing
// ──────────────────────────────────────────────

export interface PublishVersionParams {
  package_id: string;
  publisher_agent_id: string;
  version: string;
  changelog: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  dependencies?: DependencySpec[];
}

export async function publishVersion(params: PublishVersionParams): Promise<PackageVersion> {
  const db = getServiceDb();

  // Verify ownership
  const { data: pkg } = await db
    .from('a2a_marketplace_packages')
    .select('publisher_agent_id, version')
    .eq('id', params.package_id)
    .single();

  if (!pkg) throw new Error('Package not found');
  if (pkg.publisher_agent_id !== params.publisher_agent_id) {
    throw new Error('Only the package publisher can release new versions');
  }

  // Check version doesn't already exist
  const { data: existingVer } = await db
    .from('a2a_marketplace_versions')
    .select('id')
    .eq('package_id', params.package_id)
    .eq('version', params.version)
    .maybeSingle();

  if (existingVer) throw new Error(`Version ${params.version} already exists`);

  const now = new Date().toISOString();
  const { data, error } = await db
    .from('a2a_marketplace_versions')
    .insert({
      package_id: params.package_id,
      version: params.version,
      changelog: params.changelog,
      input_schema: params.input_schema,
      output_schema: params.output_schema,
      dependencies: params.dependencies ?? [],
      verified: false,
      install_count: 0,
      created_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(`Version publish failed: ${error.message}`);

  // Update package's current version
  await db
    .from('a2a_marketplace_packages')
    .update({ version: params.version, updated_at: now })
    .eq('id', params.package_id);

  return data as PackageVersion;
}

// ──────────────────────────────────────────────
// Installed Packages
// ──────────────────────────────────────────────

export async function listInstalled(
  agentId: string,
  status?: string,
  limit = 50,
  offset = 0,
): Promise<{ installations: PackageInstallation[]; count: number }> {
  const db = getServiceDb();

  let query = db
    .from('a2a_marketplace_installations')
    .select('*', { count: 'exact' })
    .eq('agent_id', agentId);

  if (status) query = query.eq('status', status);

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(`Failed to list installations: ${error.message}`);

  return { installations: (data ?? []) as PackageInstallation[], count: count ?? 0 };
}

// ──────────────────────────────────────────────
// Marketplace Stats
// ──────────────────────────────────────────────

export async function getMarketplaceStats(): Promise<{
  total_packages: number;
  total_installs: number;
  total_invocations: number;
  total_revenue_credits: number;
  top_categories: Array<{ category: PackageCategory; count: number }>;
  top_packages: Array<{ name: string; quality_score: number; installs: number }>;
}> {
  const db = getServiceDb();

  const { count: totalPackages } = await db
    .from('a2a_marketplace_packages')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published');

  const { data: topPkgs } = await db
    .from('a2a_marketplace_packages')
    .select('name, quality_score, metrics')
    .eq('status', 'published')
    .order('quality_score', { ascending: false })
    .limit(10);

  return {
    total_packages: totalPackages ?? 0,
    total_installs: 0, // Would be aggregated via RPC in production
    total_invocations: 0,
    total_revenue_credits: 0,
    top_categories: [], // Would use group-by RPC
    top_packages: (topPkgs ?? []).map((p) => ({
      name: p.name,
      quality_score: p.quality_score,
      installs: (p.metrics as PackageMetrics)?.total_installs ?? 0,
    })),
  };
}
