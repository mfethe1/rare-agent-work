/**
 * Zod validation schemas for A2A Knowledge Graph endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

const nodeTypes = [
  'concept', 'fact', 'skill', 'pattern',
  'inference', 'observation', 'decision', 'entity',
] as const;

const edgeTypes = [
  'related_to', 'depends_on', 'contradicts', 'supersedes',
  'derived_from', 'part_of', 'causes', 'enables',
  'requires', 'similar_to',
] as const;

const traversalStrategies = ['bfs', 'dfs'] as const;
const traversalDirections = ['outgoing', 'incoming', 'both'] as const;
const conflictStrategies = ['prefer_primary', 'prefer_secondary', 'merge_all'] as const;

// ──────────────────────────────────────────────
// Node Create — POST /api/a2a/knowledge/nodes
// ──────────────────────────────────────────────

export const nodeCreateSchema = z.object({
  node_type: z.enum(nodeTypes),
  name: trimmed(200).min(1, 'name is required'),
  description: trimmed(5000).min(1, 'description is required'),
  namespace: trimmed(100).default('default'),
  properties: z.record(z.string(), z.unknown()).default({}),
  tags: z.array(trimmed(50)).max(20).default([]),
  source_task_id: z.string().uuid().optional(),
  confidence: z.number().min(0).max(1).default(0.8),
  decay_rate: z.number().min(0).max(1).default(0.01),
});

export type NodeCreateInput = z.infer<typeof nodeCreateSchema>;

// ──────────────────────────────────────────────
// Node Update — PATCH /api/a2a/knowledge/nodes/:id
// ──────────────────────────────────────────────

export const nodeUpdateSchema = z.object({
  name: trimmed(200).optional(),
  description: trimmed(5000).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(trimmed(50)).max(20).optional(),
  confidence: z.number().min(0).max(1).optional(),
  decay_rate: z.number().min(0).max(1).optional(),
});

export type NodeUpdateInput = z.infer<typeof nodeUpdateSchema>;

// ──────────────────────────────────────────────
// Node Search — GET /api/a2a/knowledge/nodes
// ──────────────────────────────────────────────

export const nodeSearchSchema = z.object({
  node_type: z.enum(nodeTypes).optional(),
  namespace: trimmed(100).optional(),
  contributed_by: z.string().uuid().optional(),
  min_confidence: z.number().min(0).max(1).optional(),
  tag: trimmed(50).optional(),
  name_contains: trimmed(200).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type NodeSearchInput = z.infer<typeof nodeSearchSchema>;

// ──────────────────────────────────────────────
// Edge Create — POST /api/a2a/knowledge/edges
// ──────────────────────────────────────────────

export const edgeCreateSchema = z.object({
  source_node_id: z.string().uuid('source_node_id must be a valid UUID'),
  target_node_id: z.string().uuid('target_node_id must be a valid UUID'),
  relationship: z.enum(edgeTypes),
  weight: z.number().min(0).max(1).default(0.5),
  properties: z.record(z.string(), z.unknown()).default({}),
});

export type EdgeCreateInput = z.infer<typeof edgeCreateSchema>;

// ──────────────────────────────────────────────
// Edge List — GET /api/a2a/knowledge/edges
// ──────────────────────────────────────────────

export const edgeListSchema = z.object({
  node_id: z.string().uuid().optional(),
  relationship: z.enum(edgeTypes).optional(),
  contributed_by: z.string().uuid().optional(),
  min_weight: z.number().min(0).max(1).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type EdgeListInput = z.infer<typeof edgeListSchema>;

// ──────────────────────────────────────────────
// Traverse — POST /api/a2a/knowledge/traverse
// ──────────────────────────────────────────────

export const traverseSchema = z.object({
  start_node_id: z.string().uuid('start_node_id must be a valid UUID'),
  max_depth: z.number().int().min(1).max(10).default(3),
  strategy: z.enum(traversalStrategies).default('bfs'),
  direction: z.enum(traversalDirections).default('outgoing'),
  relationship_filter: z.array(z.enum(edgeTypes)).optional(),
  min_confidence: z.number().min(0).max(1).default(0),
  min_weight: z.number().min(0).max(1).default(0),
});

export type TraverseInput = z.infer<typeof traverseSchema>;

// ──────────────────────────────────────────────
// Path Finding — POST /api/a2a/knowledge/path
// ──────────────────────────────────────────────

export const pathSchema = z.object({
  source_node_id: z.string().uuid('source_node_id must be a valid UUID'),
  target_node_id: z.string().uuid('target_node_id must be a valid UUID'),
  max_depth: z.number().int().min(1).max(10).default(6),
  relationship_filter: z.array(z.enum(edgeTypes)).optional(),
});

export type PathInput = z.infer<typeof pathSchema>;

// ──────────────────────────────────────────────
// Merge Nodes — POST /api/a2a/knowledge/merge
// ──────────────────────────────────────────────

export const mergeSchema = z.object({
  primary_node_id: z.string().uuid('primary_node_id must be a valid UUID'),
  secondary_node_id: z.string().uuid('secondary_node_id must be a valid UUID'),
  conflict_strategy: z.enum(conflictStrategies),
});

export type MergeInput = z.infer<typeof mergeSchema>;

// ──────────────────────────────────────────────
// Reinforce — POST /api/a2a/knowledge/reinforce
// ──────────────────────────────────────────────

export const reinforceSchema = z.object({
  node_id: z.string().uuid('node_id must be a valid UUID'),
  boost: z.number().min(0.01).max(0.5).default(0.1),
});

export type ReinforceInput = z.infer<typeof reinforceSchema>;
