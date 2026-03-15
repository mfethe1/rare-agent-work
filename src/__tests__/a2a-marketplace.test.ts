/**
 * Agent Capability Marketplace — Unit Tests
 *
 * Tests quality scoring, validation schemas, and dependency resolution logic.
 */

import { describe, it, expect } from 'vitest';
import {
  computeQualityScore,
  QUALITY_WEIGHTS,
} from '../lib/a2a/marketplace/engine';
import {
  publishPackageSchema,
  searchPackagesSchema,
  installPackageSchema,
  submitReviewSchema,
  publishVersionSchema,
  resolveDepsSchema,
  listInstalledSchema,
  listReviewsSchema,
} from '../lib/a2a/marketplace/validation';
import type { PackageMetrics, QualityBreakdown } from '../lib/a2a/marketplace/types';

// ──────────────────────────────────────────────
// Quality Score Computation
// ──────────────────────────────────────────────

describe('computeQualityScore', () => {
  const baseMetrics: PackageMetrics = {
    total_installs: 0,
    active_installs: 0,
    total_invocations: 0,
    avg_latency_ms: 0,
    success_rate: 1,
    avg_rating: 0,
    review_count: 0,
    total_revenue_credits: 0,
  };

  it('returns zero scores for a brand-new package with no data', () => {
    const result = computeQualityScore(baseMetrics, 0);
    expect(result.review_score).toBe(0);
    expect(result.popularity_score).toBe(0);
    // reliability should be high (100% success, 0 latency) — 25
    expect(result.reliability_score).toBe(QUALITY_WEIGHTS.reliability);
    // maintenance: daysSinceUpdate = 0 → perfect freshness → 25
    expect(result.maintenance_score).toBe(QUALITY_WEIGHTS.maintenance);
    expect(result.total).toBe(result.review_score + result.reliability_score + result.popularity_score + result.maintenance_score);
  });

  it('scales review score with both rating and count', () => {
    const highRatedFew: PackageMetrics = { ...baseMetrics, avg_rating: 5, review_count: 2 };
    const highRatedMany: PackageMetrics = { ...baseMetrics, avg_rating: 5, review_count: 20 };
    const lowRatedMany: PackageMetrics = { ...baseMetrics, avg_rating: 2, review_count: 20 };

    const scoreFew = computeQualityScore(highRatedFew, 0);
    const scoreMany = computeQualityScore(highRatedMany, 0);
    const scoreLow = computeQualityScore(lowRatedMany, 0);

    // More reviews → higher confidence → higher score
    expect(scoreMany.review_score).toBeGreaterThan(scoreFew.review_score);
    // Higher rating → higher score
    expect(scoreMany.review_score).toBeGreaterThan(scoreLow.review_score);
    // Maximum review score with 5-star and 10+ reviews
    expect(scoreMany.review_score).toBe(QUALITY_WEIGHTS.review);
  });

  it('penalizes high latency in reliability score', () => {
    const fastMetrics: PackageMetrics = { ...baseMetrics, avg_latency_ms: 100, success_rate: 1 };
    const slowMetrics: PackageMetrics = { ...baseMetrics, avg_latency_ms: 9000, success_rate: 1 };

    const fast = computeQualityScore(fastMetrics, 0);
    const slow = computeQualityScore(slowMetrics, 0);

    expect(fast.reliability_score).toBeGreaterThan(slow.reliability_score);
  });

  it('uses logarithmic scale for popularity', () => {
    const ten: PackageMetrics = { ...baseMetrics, total_installs: 10 };
    const hundred: PackageMetrics = { ...baseMetrics, total_installs: 100 };
    const tenK: PackageMetrics = { ...baseMetrics, total_installs: 10000 };

    const s10 = computeQualityScore(ten, 0).popularity_score;
    const s100 = computeQualityScore(hundred, 0).popularity_score;
    const s10k = computeQualityScore(tenK, 0).popularity_score;

    expect(s100).toBeGreaterThan(s10);
    expect(s10k).toBeGreaterThan(s100);
    // Logarithmic: 10→100 jump is bigger relative to 100→10000 when measured in log
    expect(s10k).toBeLessThanOrEqual(QUALITY_WEIGHTS.popularity);
  });

  it('penalizes stale packages in maintenance score', () => {
    const fresh = computeQualityScore(baseMetrics, 0);
    const stale = computeQualityScore(baseMetrics, 180);
    const ancient = computeQualityScore(baseMetrics, 400);

    expect(fresh.maintenance_score).toBeGreaterThan(stale.maintenance_score);
    expect(stale.maintenance_score).toBeGreaterThan(ancient.maintenance_score);
    expect(ancient.maintenance_score).toBe(0); // > 365 days → 0
  });

  it('total never exceeds 100', () => {
    const perfectMetrics: PackageMetrics = {
      ...baseMetrics,
      avg_rating: 5,
      review_count: 100,
      success_rate: 1,
      avg_latency_ms: 0,
      total_installs: 100000,
    };
    const result = computeQualityScore(perfectMetrics, 0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('quality weights sum to 100', () => {
    const sum = QUALITY_WEIGHTS.review + QUALITY_WEIGHTS.reliability +
      QUALITY_WEIGHTS.popularity + QUALITY_WEIGHTS.maintenance;
    expect(sum).toBe(100);
  });
});

// ──────────────────────────────────────────────
// Validation Schemas
// ──────────────────────────────────────────────

describe('publishPackageSchema', () => {
  const validPackage = {
    name: '@test-agent/data-fetcher',
    display_name: 'Data Fetcher',
    description: 'A capability package that fetches data from various sources',
    version: '1.0.0',
    category: 'data-retrieval',
    pricing: { license: 'open', platform_fee_percent: 15, free_tier_calls: 0 },
    capabilities: ['data.fetch'],
  };

  it('accepts a valid package', () => {
    const result = publishPackageSchema.safeParse(validPackage);
    expect(result.success).toBe(true);
  });

  it('rejects invalid package name format', () => {
    const result = publishPackageSchema.safeParse({
      ...validPackage,
      name: 'no-scope',
    });
    expect(result.success).toBe(false);
  });

  it('rejects package name without @ scope', () => {
    const result = publishPackageSchema.safeParse({
      ...validPackage,
      name: 'publisher/name',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid scoped names', () => {
    for (const name of ['@agent/pkg', '@my-org/tool-v2', '@a/b']) {
      const result = publishPackageSchema.safeParse({ ...validPackage, name });
      expect(result.success).toBe(true);
    }
  });

  it('rejects empty capabilities', () => {
    const result = publishPackageSchema.safeParse({
      ...validPackage,
      capabilities: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const result = publishPackageSchema.safeParse({
      ...validPackage,
      category: 'invalid-category',
    });
    expect(result.success).toBe(false);
  });

  it('defaults tags to empty array', () => {
    const result = publishPackageSchema.parse(validPackage);
    expect(result.tags).toEqual([]);
  });

  it('defaults visibility to public', () => {
    const result = publishPackageSchema.parse(validPackage);
    expect(result.visibility).toBe('public');
  });

  it('validates pricing platform_fee_percent max 30', () => {
    const result = publishPackageSchema.safeParse({
      ...validPackage,
      pricing: { license: 'per-call', platform_fee_percent: 50, free_tier_calls: 0 },
    });
    expect(result.success).toBe(false);
  });

  it('validates dependencies format', () => {
    const result = publishPackageSchema.parse({
      ...validPackage,
      dependencies: [
        { package_name: '@org/dep', version_range: '^1.0.0', optional: false },
      ],
    });
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].package_name).toBe('@org/dep');
  });
});

describe('searchPackagesSchema', () => {
  it('applies defaults', () => {
    const result = searchPackagesSchema.parse({});
    expect(result.sort_by).toBe('relevance');
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('accepts all sort options', () => {
    for (const sort_by of ['relevance', 'quality', 'installs', 'rating', 'newest']) {
      const result = searchPackagesSchema.safeParse({ sort_by });
      expect(result.success).toBe(true);
    }
  });

  it('rejects limit > 100', () => {
    const result = searchPackagesSchema.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });
});

describe('installPackageSchema', () => {
  it('defaults auto_update to true', () => {
    const result = installPackageSchema.parse({});
    expect(result.auto_update).toBe(true);
    expect(result.resolve_dependencies).toBe(true);
  });
});

describe('submitReviewSchema', () => {
  it('rejects rating outside 1-5', () => {
    expect(submitReviewSchema.safeParse({ rating: 0, title: 'Bad', body: 'Really bad package here' }).success).toBe(false);
    expect(submitReviewSchema.safeParse({ rating: 6, title: 'Great', body: 'Great package overall' }).success).toBe(false);
  });

  it('accepts valid review', () => {
    const result = submitReviewSchema.safeParse({
      rating: 4,
      title: 'Great package',
      body: 'Works perfectly for our data pipeline needs',
    });
    expect(result.success).toBe(true);
  });

  it('rejects short body', () => {
    const result = submitReviewSchema.safeParse({
      rating: 4,
      title: 'Good',
      body: 'Short',
    });
    expect(result.success).toBe(false);
  });
});

describe('publishVersionSchema', () => {
  it('validates semver format', () => {
    expect(publishVersionSchema.safeParse({ version: '2.0.0', changelog: 'Breaking changes' }).success).toBe(true);
    expect(publishVersionSchema.safeParse({ version: 'not-semver', changelog: 'Bad version' }).success).toBe(false);
  });
});

describe('resolveDepsSchema', () => {
  it('requires scoped package name', () => {
    expect(resolveDepsSchema.safeParse({ package_name: '@org/pkg' }).success).toBe(true);
    expect(resolveDepsSchema.safeParse({ package_name: 'unscoped' }).success).toBe(false);
  });
});

describe('listInstalledSchema', () => {
  it('applies defaults', () => {
    const result = listInstalledSchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it('accepts status filter', () => {
    const result = listInstalledSchema.parse({ status: 'active' });
    expect(result.status).toBe('active');
  });
});

describe('listReviewsSchema', () => {
  it('defaults sort to newest', () => {
    const result = listReviewsSchema.parse({});
    expect(result.sort_by).toBe('newest');
  });

  it('accepts all sort options', () => {
    for (const sort_by of ['newest', 'highest', 'lowest', 'helpful']) {
      expect(listReviewsSchema.safeParse({ sort_by }).success).toBe(true);
    }
  });
});
