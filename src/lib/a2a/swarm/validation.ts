/**
 * Zod validation schemas for Swarm Intelligence Protocol endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

const pheromoneTypeSchema = z.enum([
  'attraction',
  'repulsion',
  'trail',
  'alarm',
  'recruitment',
  'success',
  'custom',
]);

const behaviorTypeSchema = z.enum([
  'attract',
  'repel',
  'explore',
  'exploit',
  'align',
  'forage',
  'reinforce',
  'custom',
]);

const evaporationStrategySchema = z.enum(['linear', 'exponential', 'step']);

const convergenceCriteriaSchema = z.enum([
  'pheromone_concentration',
  'agent_clustering',
  'objective_plateau',
  'custom',
]);

const positionSchema = z.record(z.string(), z.number()).refine(
  (obj) => Object.keys(obj).length > 0 && Object.keys(obj).length <= 100,
  { message: 'Position must have 1-100 dimensions' },
);

const behaviorRuleSchema = z.object({
  type: behaviorTypeSchema,
  weight: z.number().min(0).max(1),
  pheromone_triggers: z.array(pheromoneTypeSchema).min(1).max(10),
  sensing_radius: z.number().positive().max(10000),
  params: z.record(z.string(), z.unknown()).optional().default({}),
});

const objectiveSchema = z.object({
  description: trimmed(1000).min(1),
  domain: trimmed(200).min(1),
  dimensions: z.array(trimmed(100)).min(1).max(100),
  direction: z.enum(['maximize', 'minimize']),
});

const configSchema = z.object({
  evaporation_rate: z.number().min(0).max(1).optional().default(0.05),
  evaporation_strategy: evaporationStrategySchema.optional().default('exponential'),
  min_agents: z.number().int().min(1).max(10000).optional().default(2),
  max_agents: z.number().int().min(1).max(100000).optional().default(1000),
  default_sensing_radius: z.number().positive().max(10000).optional().default(100),
  exploration_rate: z.number().min(0).max(1).optional().default(0.3),
  convergence_criteria: convergenceCriteriaSchema.optional().default('pheromone_concentration'),
  convergence_threshold: z.number().min(0).optional().default(0.85),
  adaptive_params: z.boolean().optional().default(true),
});

// ── Create Swarm ─────────────────────────────────────────────────────────────

export const createSwarmSchema = z.object({
  name: trimmed(200).min(1),
  description: trimmed(2000).min(1),
  objective: objectiveSchema,
  config: configSchema.optional(),
});

export type CreateSwarmInput = z.infer<typeof createSwarmSchema>;

// ── Join Swarm ───────────────────────────────────────────────────────────────

export const joinSwarmSchema = z.object({
  behaviors: z.array(behaviorRuleSchema).min(1).max(20).optional(),
  initial_position: positionSchema.optional(),
});

export type JoinSwarmInput = z.infer<typeof joinSwarmSchema>;

// ── Deposit Pheromone ────────────────────────────────────────────────────────

export const depositPheromoneSchema = z.object({
  type: pheromoneTypeSchema,
  position: positionSchema,
  intensity: z.number().positive().max(1000),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  tags: z.array(trimmed(100)).max(20).optional().default([]),
});

export type DepositPheromoneInput = z.infer<typeof depositPheromoneSchema>;

// ── Sense Pheromones ─────────────────────────────────────────────────────────

export const sensePheromoneSchema = z.object({
  position: positionSchema,
  radius: z.number().positive().max(10000).optional(),
  types: z.array(pheromoneTypeSchema).optional(),
  min_intensity: z.number().min(0).optional().default(0.01),
  limit: z.number().int().min(1).max(500).optional().default(100),
});

export type SensePheromoneInput = z.infer<typeof sensePheromoneSchema>;

// ── Report Solution ──────────────────────────────────────────────────────────

export const reportSolutionSchema = z.object({
  position: positionSchema,
  score: z.number(),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export type ReportSolutionInput = z.infer<typeof reportSolutionSchema>;

// ── List Swarms ──────────────────────────────────────────────────────────────

export const listSwarmsSchema = z.object({
  status: z.enum(['initializing', 'active', 'converging', 'stagnant', 'dissolved']).optional(),
  domain: trimmed(200).optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

export type ListSwarmsInput = z.infer<typeof listSwarmsSchema>;
