/**
 * Agent Evolution & Natural Selection
 *
 * Darwinian evolution for the A2A ecosystem. Agents encode genomes,
 * reproduce via crossover and mutation, face fitness evaluation,
 * undergo natural selection, speciate into niches, and track full genealogy.
 * Transforms a static agent registry into a living, self-improving system.
 */

// ── Types ──
export type {
  Gene,
  GeneType,
  GeneValue,
  GeneConstraints,
  Genome,
  FitnessScore,
  FitnessDimension,
  Population,
  PopulationStatus,
  SelectionStrategy,
  CrossoverMethod,
  MutationType,
  Species,
  LineageRecord,
  MutationRecord,
  GenealogyNode,
  GenealogyTree,
  SeedGenomeInput,
  CreatePopulationRequest,
  CreatePopulationResponse,
  EvaluateFitnessRequest,
  EvaluateFitnessResponse,
  AdvanceGenerationResponse,
  CrossoverRequest,
  CrossoverResponse,
  MutateRequest,
  MutateResponse,
  PopulationListResponse,
  PopulationDetailResponse,
  LineageResponse,
  GenerationStats,
} from './types';

// ── Engine ──
export {
  createPopulation,
  getPopulation,
  listPopulations,
  evaluateFitness,
  selectParent,
  crossover,
  mutate,
  advanceGeneration,
  getLineage,
  getGenome,
  listGenomesForPopulation,
  resetEvolutionStores,
} from './engine';
export type { CreatePopulationParams } from './engine';

// ── Validation ──
export {
  createPopulationSchema,
  listPopulationsSchema,
  evaluateFitnessSchema,
  crossoverSchema,
  mutateSchema,
} from './validation';
export type {
  CreatePopulationInput,
  ListPopulationsInput,
  EvaluateFitnessInput,
  CrossoverInput,
  MutateInput,
} from './validation';
