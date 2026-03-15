/**
 * Agent Evolution & Natural Selection Types
 *
 * In 2028, premier A2A ecosystems are living systems. Agents encode their
 * configuration as genomes, reproduce with mutations, crossover capabilities,
 * face fitness evaluation from task outcomes, and undergo Darwinian selection.
 * The ecosystem itself drives emergent optimization — unfit agents are pruned,
 * successful strategies propagate, and entirely new capability niches emerge.
 */

// ── Genome ──

/** A single gene: one tunable parameter in an agent's configuration. */
export interface Gene {
  /** Machine-readable gene ID (e.g., "response_style", "model_preference"). */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Gene type determines valid values and mutation operators. */
  type: GeneType;
  /** Current allele (value) for this gene. */
  value: GeneValue;
  /** Constraints on valid values. */
  constraints?: GeneConstraints;
  /** Mutation rate override (0–1). Higher = more likely to mutate. */
  mutation_rate?: number;
  /** Whether this gene can be swapped during crossover. */
  crossover_eligible?: boolean;
}

export type GeneType = 'numeric' | 'categorical' | 'boolean' | 'vector' | 'capability_set';

export type GeneValue = number | string | boolean | number[] | string[];

export interface GeneConstraints {
  /** For numeric genes: min/max range. */
  min?: number;
  max?: number;
  step?: number;
  /** For categorical genes: allowed values. */
  options?: string[];
  /** For vector genes: fixed dimensionality. */
  dimensions?: number;
  /** For capability_set genes: max capabilities. */
  max_items?: number;
}

/** Complete genome: the full genetic blueprint of an agent variant. */
export interface Genome {
  /** Unique genome ID. */
  id: string;
  /** Agent ID this genome belongs to. */
  agent_id: string;
  /** Generation number (0 = seed, increments on reproduction). */
  generation: number;
  /** All genes in this genome. */
  genes: Gene[];
  /** Genome metadata tags (e.g., species, niche). */
  tags: string[];
  /** SHA-256 fingerprint of sorted gene values — used for dedup. */
  fingerprint: string;
  created_at: string;
}

// ── Fitness ──

/** Fitness evaluation result for a genome. */
export interface FitnessScore {
  /** Genome being evaluated. */
  genome_id: string;
  /** Overall fitness (0–1). */
  overall: number;
  /** Breakdown by fitness dimension. */
  dimensions: FitnessDimension[];
  /** Number of tasks evaluated. */
  sample_size: number;
  /** Statistical confidence (0–1). */
  confidence: number;
  evaluated_at: string;
}

export interface FitnessDimension {
  /** Dimension name (e.g., "task_success", "latency", "cost_efficiency"). */
  name: string;
  /** Score for this dimension (0–1). */
  score: number;
  /** Weight in overall fitness calculation. */
  weight: number;
}

// ── Population ──

export type PopulationStatus = 'initializing' | 'active' | 'converged' | 'archived';

export type SelectionStrategy =
  | 'tournament'       // k-way tournament selection
  | 'roulette'         // fitness-proportionate
  | 'rank'             // rank-based
  | 'elitist'          // top-N survive unchanged
  | 'truncation';      // bottom % culled

export type CrossoverMethod =
  | 'single_point'     // split at one gene boundary
  | 'two_point'        // split at two boundaries
  | 'uniform'          // each gene independently chosen
  | 'capability_blend'; // merge capability sets with dedup

export type MutationType =
  | 'gaussian'         // add Gaussian noise to numeric genes
  | 'swap'             // swap two gene values
  | 'flip'             // flip boolean genes
  | 'resample'         // resample from constraints
  | 'drift';           // small random walk

/** A population of evolving agent genomes. */
export interface Population {
  /** Unique population ID. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** What this population is optimizing for. */
  objective: string;
  /** Agent who created this population. */
  owner_id: string;
  /** Current generation number. */
  generation: number;
  /** Max generations before auto-archive. */
  max_generations: number;
  /** Target population size per generation. */
  population_size: number;
  /** Current genome IDs in the population. */
  genome_ids: string[];
  /** Selection strategy. */
  selection_strategy: SelectionStrategy;
  /** Selection pressure (0–1). Higher = more aggressive culling. */
  selection_pressure: number;
  /** Crossover method. */
  crossover_method: CrossoverMethod;
  /** Crossover rate (0–1). */
  crossover_rate: number;
  /** Default mutation rate (0–1). */
  mutation_rate: number;
  /** Mutation types to apply. */
  mutation_types: MutationType[];
  /** Elitism: top N genomes pass through unchanged. */
  elite_count: number;
  /** Fitness dimension weights. */
  fitness_weights: Record<string, number>;
  /** Convergence threshold: if top fitness doesn't improve by this much, converge. */
  convergence_threshold: number;
  /** Generations without improvement before declaring convergence. */
  stagnation_limit: number;
  /** Generations since last fitness improvement. */
  stagnation_count: number;
  /** Best fitness score seen so far. */
  best_fitness: number;
  /** Status. */
  status: PopulationStatus;
  /** Species clusters within this population. */
  species: Species[];
  created_at: string;
  updated_at: string;
}

/** A species: a cluster of similar genomes within a population. */
export interface Species {
  /** Species ID. */
  id: string;
  /** Representative genome ID (centroid). */
  representative_id: string;
  /** Genome IDs in this species. */
  member_ids: string[];
  /** Ecological niche description. */
  niche: string;
  /** Average fitness of members. */
  avg_fitness: number;
  /** Generation this species emerged. */
  emerged_at: number;
}

// ── Lineage ──

export type ReproductionMethod = 'seed' | 'mutation' | 'crossover' | 'clone';

/** Lineage record tracking how a genome was created. */
export interface LineageRecord {
  /** Genome ID. */
  genome_id: string;
  /** Parent genome ID(s). One for mutation/clone, two for crossover, none for seed. */
  parent_ids: string[];
  /** How this genome was produced. */
  method: ReproductionMethod;
  /** Population this occurred in. */
  population_id: string;
  /** Generation number. */
  generation: number;
  /** Specific mutations applied (if method = mutation). */
  mutations_applied?: MutationRecord[];
  /** Crossover point(s) (if method = crossover). */
  crossover_points?: number[];
  created_at: string;
}

export interface MutationRecord {
  gene_id: string;
  old_value: GeneValue;
  new_value: GeneValue;
  mutation_type: MutationType;
}

// ── Genealogy Tree ──

export interface GenealogyNode {
  genome_id: string;
  agent_id: string;
  generation: number;
  fitness?: number;
  method: ReproductionMethod;
  children_ids: string[];
  parent_ids: string[];
}

export interface GenealogyTree {
  root_ids: string[];
  nodes: Record<string, GenealogyNode>;
  total_generations: number;
  total_genomes: number;
}

// ── API Request/Response Types ──

export interface CreatePopulationRequest {
  name: string;
  objective: string;
  seed_genomes: SeedGenomeInput[];
  population_size?: number;
  max_generations?: number;
  selection_strategy?: SelectionStrategy;
  selection_pressure?: number;
  crossover_method?: CrossoverMethod;
  crossover_rate?: number;
  mutation_rate?: number;
  mutation_types?: MutationType[];
  elite_count?: number;
  fitness_weights?: Record<string, number>;
  convergence_threshold?: number;
  stagnation_limit?: number;
}

export interface SeedGenomeInput {
  agent_id: string;
  genes: Omit<Gene, 'mutation_rate' | 'crossover_eligible'>[];
  tags?: string[];
}

export interface CreatePopulationResponse {
  population: Population;
  genomes: Genome[];
}

export interface EvaluateFitnessRequest {
  genome_id: string;
  dimensions: { name: string; score: number }[];
  sample_size: number;
}

export interface EvaluateFitnessResponse {
  fitness: FitnessScore;
}

export interface AdvanceGenerationResponse {
  population: Population;
  new_genomes: Genome[];
  culled_genome_ids: string[];
  lineage_records: LineageRecord[];
  converged: boolean;
  generation_stats: GenerationStats;
}

export interface GenerationStats {
  generation: number;
  best_fitness: number;
  avg_fitness: number;
  worst_fitness: number;
  fitness_std_dev: number;
  species_count: number;
  new_species: number;
  extinct_species: number;
  mutations_applied: number;
  crossovers_performed: number;
  elite_preserved: number;
}

export interface CrossoverRequest {
  parent_a_id: string;
  parent_b_id: string;
  method?: CrossoverMethod;
}

export interface CrossoverResponse {
  offspring: Genome;
  lineage: LineageRecord;
}

export interface MutateRequest {
  genome_id: string;
  mutation_types?: MutationType[];
  mutation_rate?: number;
}

export interface MutateResponse {
  mutant: Genome;
  lineage: LineageRecord;
  mutations: MutationRecord[];
}

export interface PopulationListResponse {
  populations: Population[];
  total: number;
}

export interface PopulationDetailResponse {
  population: Population;
  genomes: Genome[];
  fitness_scores: FitnessScore[];
  generation_history: GenerationStats[];
}

export interface LineageResponse {
  tree: GenealogyTree;
}
