/**
 * Agent Capability Marketplace — Zod Validation Schemas
 */

import { z } from 'zod';

// ── Enums ──

const PackageLicenseEnum = z.enum([
  'open', 'attribution', 'non-commercial', 'per-call', 'subscription', 'enterprise',
]);

const PackageVisibilityEnum = z.enum(['public', 'unlisted', 'private', 'org-only']);

const PackageCategoryEnum = z.enum([
  'data-retrieval', 'data-transformation', 'analysis', 'generation',
  'communication', 'integration', 'security', 'orchestration',
  'monitoring', 'utility',
]);

const SortByEnum = z.enum(['relevance', 'quality', 'installs', 'rating', 'newest']);

// ── Shared sub-schemas ──

const dependencySpecSchema = z.object({
  package_name: z.string().min(1).max(128),
  version_range: z.string().min(1).max(64),
  optional: z.boolean().default(false),
});

const pricingSchema = z.object({
  license: PackageLicenseEnum,
  per_call_credits: z.number().min(0).optional(),
  monthly_credits: z.number().min(0).optional(),
  platform_fee_percent: z.number().min(0).max(30).default(15),
  free_tier_calls: z.number().int().min(0).default(0),
});

// Scoped package name: @publisher/name
const packageNameRegex = /^@[\w-]{1,64}\/[\w-]{1,64}$/;

// ── Publish Package ──

export const publishPackageSchema = z.object({
  name: z.string().regex(packageNameRegex, 'Package name must be @publisher/name format'),
  display_name: z.string().min(1).max(128),
  description: z.string().min(10).max(4096),
  version: z.string().regex(/^\d+\.\d+\.\d+/, 'Must be valid semver'),
  category: PackageCategoryEnum,
  tags: z.array(z.string().min(1).max(32)).max(10).default([]),
  visibility: PackageVisibilityEnum.default('public'),
  pricing: pricingSchema,
  capabilities: z.array(z.string().min(1).max(128)).min(1).max(20),
  input_schema: z.record(z.unknown()).optional(),
  output_schema: z.record(z.unknown()).optional(),
  dependencies: z.array(dependencySpecSchema).max(50).default([]),
  min_sdk_version: z.string().max(32).optional(),
  changelog: z.string().max(8192).optional(),
});
export type PublishPackageInput = z.infer<typeof publishPackageSchema>;

// ── Search Packages ──

export const searchPackagesSchema = z.object({
  query: z.string().max(256).optional(),
  category: PackageCategoryEnum.optional(),
  tags: z.array(z.string()).max(5).optional(),
  license: PackageLicenseEnum.optional(),
  min_rating: z.number().min(1).max(5).optional(),
  sort_by: SortByEnum.default('relevance'),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});
export type SearchPackagesInput = z.infer<typeof searchPackagesSchema>;

// ── Install Package ──

export const installPackageSchema = z.object({
  version: z.string().max(32).optional(),
  auto_update: z.boolean().default(true),
  resolve_dependencies: z.boolean().default(true),
});
export type InstallPackageInput = z.infer<typeof installPackageSchema>;

// ── Uninstall Package ──

export const uninstallPackageSchema = z.object({
  remove_unused_dependencies: z.boolean().default(false),
});
export type UninstallPackageInput = z.infer<typeof uninstallPackageSchema>;

// ── Submit Review ──

export const submitReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(200),
  body: z.string().min(10).max(4096),
});
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

// ── Publish Version ──

export const publishVersionSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+/, 'Must be valid semver'),
  changelog: z.string().min(1).max(8192),
  input_schema: z.record(z.unknown()).optional(),
  output_schema: z.record(z.unknown()).optional(),
  dependencies: z.array(dependencySpecSchema).max(50).optional(),
});
export type PublishVersionInput = z.infer<typeof publishVersionSchema>;

// ── Resolve Dependencies ──

export const resolveDepsSchema = z.object({
  package_name: z.string().regex(packageNameRegex),
  version: z.string().max(32).optional(),
});
export type ResolveDepsInput = z.infer<typeof resolveDepsSchema>;

// ── List Installed ──

export const listInstalledSchema = z.object({
  status: z.enum(['active', 'suspended', 'uninstalled']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
export type ListInstalledInput = z.infer<typeof listInstalledSchema>;

// ── List Reviews ──

export const listReviewsSchema = z.object({
  sort_by: z.enum(['newest', 'highest', 'lowest', 'helpful']).default('newest'),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});
export type ListReviewsInput = z.infer<typeof listReviewsSchema>;
