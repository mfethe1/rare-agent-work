/**
 * Agent Evolution & Natural Selection — Zod Validation Schemas
 */

import { z } from 'zod';

// ── Gene schemas ──

const geneConstraintsSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  options: z.array(z.string()).optional(),
  dimensions: z.number().int().positive().optional(),
  max_items: z.number().int().positive().optional(),
});

const geneTypeSchema = z.enum(['numeric', 'categorical', 'boolean', 'vector', 'capability_set']);

const geneValueSchema = z.union([
  z.number(),
  z.string(),
  z.boolean(),
  z.array(z.number()),
  z.array(z.string()),
]);

const geneInputSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  type: geneTypeSchema,
  value: geneValueSchema,
  constraints: geneConstraintsSchema.optional(),
});

// ── Selection / crossover / mutation enums ──

const selectionStrategySchema = z.enum([
  'tournament', 'roulette', 'rank', 'elitist', 'truncation',
]);

const crossoverMethodSchema = z.enum([
  'single_point', 'two_point', 'uniform', 'capability_blend',
]);

const mutationTypeSchema = z.enum([
  'gaussian', 'swap', 'flip', 'resample', 'drift',
]);

// ── Create Population ──

const seedGenomeSchema = z.object({
  agent_id: z.string().min(1),
  genes: z.array(geneInputSchema).min(1).max(100),
  tags: z.array(z.string()).max(20).optional(),
});

export const createPopulationSchema = z.object({
  name: z.string().min(1).max(200),
  objective: z.string().min(1).max(500),
  seed_genomes: z.array(seedGenomeSchema).min(1).max(200),
  population_size: z.number().int().min(2).max(1000).optional(),
  max_generations: z.number().int().min(1).max(10000).optional(),
  selection_strategy: selectionStrategySchema.optional(),
  selection_pressure: z.number().min(0).max(1).optional(),
  crossover_method: crossoverMethodSchema.optional(),
  crossover_rate: z.number().min(0).max(1).optional(),
  mutation_rate: z.number().min(0).max(1).optional(),
  mutation_types: z.array(mutationTypeSchema).min(1).optional(),
  elite_count: z.number().int().min(0).max(50).optional(),
  fitness_weights: z.record(z.string(), z.number().min(0).max(1)).optional(),
  convergence_threshold: z.number().min(0).max(1).optional(),
  stagnation_limit: z.number().int().min(1).max(1000).optional(),
});

export type CreatePopulationInput = z.infer<typeof createPopulationSchema>;

// ── List Populations ──

export const listPopulationsSchema = z.object({
  status: z.enum(['initializing', 'active', 'converged', 'archived']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type ListPopulationsInput = z.infer<typeof listPopulationsSchema>;

// ── Evaluate Fitness ──

export const evaluateFitnessSchema = z.object({
  genome_id: z.string().min(1),
  dimensions: z.array(z.object({
    name: z.string().min(1),
    score: z.number().min(0).max(1),
  })).min(1).max(20),
  sample_size: z.number().int().min(1).max(100000),
});

export type EvaluateFitnessInput = z.infer<typeof evaluateFitnessSchema>;

// ── Crossover ──

export const crossoverSchema = z.object({
  parent_a_id: z.string().min(1),
  parent_b_id: z.string().min(1),
  method: crossoverMethodSchema.optional(),
});

export type CrossoverInput = z.infer<typeof crossoverSchema>;

// ── Mutate ──

export const mutateSchema = z.object({
  genome_id: z.string().min(1),
  mutation_types: z.array(mutationTypeSchema).min(1).optional(),
  mutation_rate: z.number().min(0).max(1).optional(),
});

export type MutateInput = z.infer<typeof mutateSchema>;
