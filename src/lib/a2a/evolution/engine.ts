/**
 * Agent Evolution & Natural Selection Engine
 *
 * Core evolutionary algorithms: genome management, fitness evaluation,
 * selection, crossover, mutation, speciation, and generational advancement.
 * Transforms the A2A ecosystem from a static registry into a living,
 * self-improving Darwinian system.
 */

import { createHash } from 'crypto';
import type {
  Genome,
  Gene,
  GeneValue,
  GeneType,
  FitnessScore,
  FitnessDimension,
  Population,
  PopulationStatus,
  Species,
  SelectionStrategy,
  CrossoverMethod,
  MutationType,
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

// ── In-memory stores ──

const populations = new Map<string, Population>();
const genomes = new Map<string, Genome>();
const fitnessScores = new Map<string, FitnessScore>();
const lineageRecords = new Map<string, LineageRecord>();
const generationHistory = new Map<string, GenerationStats[]>(); // populationId -> stats[]

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(++idCounter).toString(36)}`;
}

function computeFingerprint(genes: Gene[]): string {
  const sorted = [...genes].sort((a, b) => a.id.localeCompare(b.id));
  const payload = sorted.map((g) => `${g.id}:${JSON.stringify(g.value)}`).join('|');
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

function cloneGene(gene: Gene): Gene {
  return {
    ...gene,
    value: Array.isArray(gene.value) ? [...gene.value] : gene.value,
    constraints: gene.constraints ? { ...gene.constraints } : undefined,
  };
}

// ── Population Management ──

export interface CreatePopulationParams {
  owner_id: string;
  input: CreatePopulationRequest;
}

export function createPopulation(params: CreatePopulationParams): CreatePopulationResponse {
  const { owner_id, input } = params;
  const popId = nextId('pop');
  const now = new Date().toISOString();

  // Create seed genomes
  const seedGenomes: Genome[] = input.seed_genomes.map((seed) => {
    const genes: Gene[] = seed.genes.map((g) => ({
      ...g,
      mutation_rate: undefined,
      crossover_eligible: true,
    }));
    const genome: Genome = {
      id: nextId('gen'),
      agent_id: seed.agent_id,
      generation: 0,
      genes,
      tags: seed.tags ?? [],
      fingerprint: computeFingerprint(genes),
      created_at: now,
    };
    genomes.set(genome.id, genome);

    // Seed lineage
    const lr: LineageRecord = {
      genome_id: genome.id,
      parent_ids: [],
      method: 'seed',
      population_id: popId,
      generation: 0,
      created_at: now,
    };
    lineageRecords.set(genome.id, lr);

    return genome;
  });

  const population: Population = {
    id: popId,
    name: input.name,
    objective: input.objective,
    owner_id,
    generation: 0,
    max_generations: input.max_generations ?? 100,
    population_size: input.population_size ?? seedGenomes.length,
    genome_ids: seedGenomes.map((g) => g.id),
    selection_strategy: input.selection_strategy ?? 'tournament',
    selection_pressure: input.selection_pressure ?? 0.6,
    crossover_method: input.crossover_method ?? 'uniform',
    crossover_rate: input.crossover_rate ?? 0.7,
    mutation_rate: input.mutation_rate ?? 0.1,
    mutation_types: input.mutation_types ?? ['gaussian', 'flip', 'resample'],
    elite_count: input.elite_count ?? 1,
    fitness_weights: input.fitness_weights ?? { task_success: 0.4, latency: 0.2, cost_efficiency: 0.2, reliability: 0.2 },
    convergence_threshold: input.convergence_threshold ?? 0.001,
    stagnation_limit: input.stagnation_limit ?? 10,
    stagnation_count: 0,
    best_fitness: 0,
    status: 'active',
    species: [],
    created_at: now,
    updated_at: now,
  };

  populations.set(popId, population);
  generationHistory.set(popId, []);

  return { population, genomes: seedGenomes };
}

export function getPopulation(populationId: string): PopulationDetailResponse | null {
  const pop = populations.get(populationId);
  if (!pop) return null;

  const popGenomes = pop.genome_ids.map((id) => genomes.get(id)).filter(Boolean) as Genome[];
  const scores = popGenomes
    .map((g) => fitnessScores.get(g.id))
    .filter(Boolean) as FitnessScore[];
  const history = generationHistory.get(populationId) ?? [];

  return { population: pop, genomes: popGenomes, fitness_scores: scores, generation_history: history };
}

export function listPopulations(ownerId?: string, status?: PopulationStatus): PopulationListResponse {
  let pops = Array.from(populations.values());
  if (ownerId) pops = pops.filter((p) => p.owner_id === ownerId);
  if (status) pops = pops.filter((p) => p.status === status);
  return { populations: pops, total: pops.length };
}

// ── Fitness Evaluation ──

export function evaluateFitness(
  input: EvaluateFitnessRequest,
  weights?: Record<string, number>,
): EvaluateFitnessResponse | null {
  const genome = genomes.get(input.genome_id);
  if (!genome) return null;

  const effectiveWeights = weights ?? { task_success: 0.4, latency: 0.2, cost_efficiency: 0.2, reliability: 0.2 };
  const totalWeight = Object.values(effectiveWeights).reduce((s, w) => s + w, 0) || 1;

  const dimensions: FitnessDimension[] = input.dimensions.map((d) => ({
    name: d.name,
    score: Math.max(0, Math.min(1, d.score)),
    weight: effectiveWeights[d.name] ?? 0,
  }));

  const overall = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0) / totalWeight;
  const confidence = Math.min(1, input.sample_size / 100);

  const fitness: FitnessScore = {
    genome_id: input.genome_id,
    overall,
    dimensions,
    sample_size: input.sample_size,
    confidence,
    evaluated_at: new Date().toISOString(),
  };

  fitnessScores.set(input.genome_id, fitness);
  return { fitness };
}

// ── Selection ──

function getFitness(genomeId: string): number {
  return fitnessScores.get(genomeId)?.overall ?? 0;
}

function tournamentSelect(genomeIds: string[], k: number): string {
  const candidates: string[] = [];
  for (let i = 0; i < k; i++) {
    candidates.push(genomeIds[Math.floor(Math.random() * genomeIds.length)]);
  }
  candidates.sort((a, b) => getFitness(b) - getFitness(a));
  return candidates[0];
}

function rouletteSelect(genomeIds: string[]): string {
  const fitnesses = genomeIds.map((id) => Math.max(getFitness(id), 0.001));
  const total = fitnesses.reduce((s, f) => s + f, 0);
  let spin = Math.random() * total;
  for (let i = 0; i < genomeIds.length; i++) {
    spin -= fitnesses[i];
    if (spin <= 0) return genomeIds[i];
  }
  return genomeIds[genomeIds.length - 1];
}

function rankSelect(genomeIds: string[]): string {
  const sorted = [...genomeIds].sort((a, b) => getFitness(a) - getFitness(b));
  // Linear ranking: rank 1 (worst) to N (best)
  const totalRank = (sorted.length * (sorted.length + 1)) / 2;
  let spin = Math.random() * totalRank;
  for (let i = 0; i < sorted.length; i++) {
    spin -= i + 1;
    if (spin <= 0) return sorted[i];
  }
  return sorted[sorted.length - 1];
}

export function selectParent(
  genomeIds: string[],
  strategy: SelectionStrategy,
  pressure: number,
): string {
  const k = Math.max(2, Math.round(pressure * genomeIds.length));
  switch (strategy) {
    case 'tournament':
      return tournamentSelect(genomeIds, Math.min(k, 5));
    case 'roulette':
      return rouletteSelect(genomeIds);
    case 'rank':
      return rankSelect(genomeIds);
    case 'elitist': {
      const sorted = [...genomeIds].sort((a, b) => getFitness(b) - getFitness(a));
      return sorted[Math.floor(Math.random() * Math.max(1, Math.round(sorted.length * pressure)))];
    }
    case 'truncation': {
      const sorted = [...genomeIds].sort((a, b) => getFitness(b) - getFitness(a));
      const cutoff = Math.max(1, Math.round(sorted.length * (1 - pressure)));
      return sorted[Math.floor(Math.random() * cutoff)];
    }
    default:
      return tournamentSelect(genomeIds, 3);
  }
}

// ── Crossover ──

export function crossover(req: CrossoverRequest, populationId: string): CrossoverResponse | null {
  const parentA = genomes.get(req.parent_a_id);
  const parentB = genomes.get(req.parent_b_id);
  if (!parentA || !parentB) return null;

  const method = req.method ?? 'uniform';
  const offspringGenes: Gene[] = [];
  const crossoverPoints: number[] = [];

  // Build gene maps for both parents
  const genesA = new Map(parentA.genes.map((g) => [g.id, g]));
  const genesB = new Map(parentB.genes.map((g) => [g.id, g]));
  const allGeneIds = new Set([...genesA.keys(), ...genesB.keys()]);
  const geneIdList = Array.from(allGeneIds);

  switch (method) {
    case 'single_point': {
      const point = Math.floor(Math.random() * geneIdList.length);
      crossoverPoints.push(point);
      geneIdList.forEach((id, i) => {
        const source = i < point ? genesA : genesB;
        const fallback = i < point ? genesB : genesA;
        const gene = source.get(id) ?? fallback.get(id);
        if (gene) offspringGenes.push(cloneGene(gene));
      });
      break;
    }
    case 'two_point': {
      const p1 = Math.floor(Math.random() * geneIdList.length);
      const p2 = Math.floor(Math.random() * geneIdList.length);
      const lo = Math.min(p1, p2);
      const hi = Math.max(p1, p2);
      crossoverPoints.push(lo, hi);
      geneIdList.forEach((id, i) => {
        const source = i < lo || i >= hi ? genesA : genesB;
        const fallback = i < lo || i >= hi ? genesB : genesA;
        const gene = source.get(id) ?? fallback.get(id);
        if (gene) offspringGenes.push(cloneGene(gene));
      });
      break;
    }
    case 'uniform': {
      geneIdList.forEach((id) => {
        const source = Math.random() < 0.5 ? genesA : genesB;
        const fallback = source === genesA ? genesB : genesA;
        const gene = source.get(id) ?? fallback.get(id);
        if (gene) offspringGenes.push(cloneGene(gene));
      });
      break;
    }
    case 'capability_blend': {
      // For capability_set genes, merge and deduplicate; others use uniform
      geneIdList.forEach((id) => {
        const gA = genesA.get(id);
        const gB = genesB.get(id);
        if (gA && gB && gA.type === 'capability_set' && gB.type === 'capability_set') {
          const merged = Array.from(new Set([
            ...(Array.isArray(gA.value) ? gA.value : []),
            ...(Array.isArray(gB.value) ? gB.value : []),
          ]));
          const maxItems = gA.constraints?.max_items ?? 20;
          const gene = cloneGene(gA);
          gene.value = merged.slice(0, maxItems);
          offspringGenes.push(gene);
        } else {
          const source = Math.random() < 0.5 ? gA : gB;
          const gene = source ?? gA ?? gB;
          if (gene) offspringGenes.push(cloneGene(gene));
        }
      });
      break;
    }
  }

  const now = new Date().toISOString();
  const gen = Math.max(parentA.generation, parentB.generation) + 1;
  const offspring: Genome = {
    id: nextId('gen'),
    agent_id: parentA.agent_id, // inherit from first parent
    generation: gen,
    genes: offspringGenes,
    tags: Array.from(new Set([...parentA.tags, ...parentB.tags])),
    fingerprint: computeFingerprint(offspringGenes),
    created_at: now,
  };

  genomes.set(offspring.id, offspring);

  const lineage: LineageRecord = {
    genome_id: offspring.id,
    parent_ids: [req.parent_a_id, req.parent_b_id],
    method: 'crossover',
    population_id: populationId,
    generation: gen,
    crossover_points: crossoverPoints,
    created_at: now,
  };
  lineageRecords.set(offspring.id, lineage);

  return { offspring, lineage };
}

// ── Mutation ──

function mutateGeneValue(gene: Gene, mutationType: MutationType): GeneValue {
  const { type, value, constraints } = gene;

  switch (mutationType) {
    case 'gaussian': {
      if (type === 'numeric' && typeof value === 'number') {
        const range = (constraints?.max ?? 1) - (constraints?.min ?? 0);
        const noise = (Math.random() - 0.5) * range * 0.2;
        let newVal = value + noise;
        if (constraints?.min !== undefined) newVal = Math.max(constraints.min, newVal);
        if (constraints?.max !== undefined) newVal = Math.min(constraints.max, newVal);
        if (constraints?.step) newVal = Math.round(newVal / constraints.step) * constraints.step;
        return newVal;
      }
      if (type === 'vector' && Array.isArray(value)) {
        return (value as number[]).map((v) => {
          const noise = (Math.random() - 0.5) * 0.2;
          return Math.max(0, Math.min(1, v + noise));
        });
      }
      return value;
    }
    case 'flip': {
      if (type === 'boolean') return !value;
      return value;
    }
    case 'swap': {
      if (type === 'categorical' && constraints?.options?.length) {
        const opts = constraints.options.filter((o) => o !== value);
        return opts.length > 0 ? opts[Math.floor(Math.random() * opts.length)] : value;
      }
      return value;
    }
    case 'resample': {
      if (type === 'numeric') {
        const min = constraints?.min ?? 0;
        const max = constraints?.max ?? 1;
        let v = min + Math.random() * (max - min);
        if (constraints?.step) v = Math.round(v / constraints.step) * constraints.step;
        return v;
      }
      if (type === 'categorical' && constraints?.options?.length) {
        return constraints.options[Math.floor(Math.random() * constraints.options.length)];
      }
      if (type === 'boolean') return Math.random() < 0.5;
      return value;
    }
    case 'drift': {
      if (type === 'numeric' && typeof value === 'number') {
        const range = (constraints?.max ?? 1) - (constraints?.min ?? 0);
        const drift = (Math.random() - 0.5) * range * 0.05;
        let newVal = value + drift;
        if (constraints?.min !== undefined) newVal = Math.max(constraints.min, newVal);
        if (constraints?.max !== undefined) newVal = Math.min(constraints.max, newVal);
        return newVal;
      }
      return value;
    }
    default:
      return value;
  }
}

function pickMutationType(geneType: GeneType, allowed: MutationType[]): MutationType {
  const compatible: Record<GeneType, MutationType[]> = {
    numeric: ['gaussian', 'resample', 'drift'],
    categorical: ['swap', 'resample'],
    boolean: ['flip'],
    vector: ['gaussian', 'drift'],
    capability_set: ['resample'],
  };
  const candidates = allowed.filter((m) => compatible[geneType]?.includes(m));
  return candidates.length > 0
    ? candidates[Math.floor(Math.random() * candidates.length)]
    : 'resample';
}

export function mutate(req: MutateRequest, populationId: string): MutateResponse | null {
  const source = genomes.get(req.genome_id);
  if (!source) return null;

  const rate = req.mutation_rate ?? 0.1;
  const types = req.mutation_types ?? ['gaussian', 'flip', 'resample'];
  const mutations: MutationRecord[] = [];

  const mutatedGenes = source.genes.map((gene) => {
    const effectiveRate = gene.mutation_rate ?? rate;
    if (Math.random() >= effectiveRate) return cloneGene(gene);

    const mt = pickMutationType(gene.type, types);
    const oldValue = gene.value;
    const newValue = mutateGeneValue(gene, mt);

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      mutations.push({
        gene_id: gene.id,
        old_value: oldValue,
        new_value: newValue,
        mutation_type: mt,
      });
    }

    const mutated = cloneGene(gene);
    mutated.value = newValue;
    return mutated;
  });

  const now = new Date().toISOString();
  const mutant: Genome = {
    id: nextId('gen'),
    agent_id: source.agent_id,
    generation: source.generation + 1,
    genes: mutatedGenes,
    tags: [...source.tags],
    fingerprint: computeFingerprint(mutatedGenes),
    created_at: now,
  };

  genomes.set(mutant.id, mutant);

  const lineage: LineageRecord = {
    genome_id: mutant.id,
    parent_ids: [req.genome_id],
    method: 'mutation',
    population_id: populationId,
    generation: mutant.generation,
    mutations_applied: mutations,
    created_at: now,
  };
  lineageRecords.set(mutant.id, lineage);

  return { mutant, lineage, mutations };
}

// ── Speciation ──

function genomeDistance(a: Genome, b: Genome): number {
  const genesA = new Map(a.genes.map((g) => [g.id, g]));
  const genesB = new Map(b.genes.map((g) => [g.id, g]));
  const allIds = new Set([...genesA.keys(), ...genesB.keys()]);

  let totalDist = 0;
  let count = 0;

  for (const id of allIds) {
    const gA = genesA.get(id);
    const gB = genesB.get(id);

    if (!gA || !gB) {
      totalDist += 1; // disjoint gene
      count++;
      continue;
    }

    if (gA.type === 'numeric' && typeof gA.value === 'number' && typeof gB.value === 'number') {
      const range = (gA.constraints?.max ?? 1) - (gA.constraints?.min ?? 0);
      totalDist += range > 0 ? Math.abs(gA.value - gB.value) / range : 0;
    } else if (JSON.stringify(gA.value) !== JSON.stringify(gB.value)) {
      totalDist += 1;
    }
    count++;
  }

  return count > 0 ? totalDist / count : 0;
}

function speciate(population: Population): Species[] {
  const popGenomes = population.genome_ids
    .map((id) => genomes.get(id))
    .filter(Boolean) as Genome[];

  if (popGenomes.length === 0) return [];

  const DISTANCE_THRESHOLD = 0.3;
  const species: Species[] = [];

  for (const genome of popGenomes) {
    let placed = false;
    for (const sp of species) {
      const rep = genomes.get(sp.representative_id);
      if (rep && genomeDistance(genome, rep) < DISTANCE_THRESHOLD) {
        sp.member_ids.push(genome.id);
        placed = true;
        break;
      }
    }
    if (!placed) {
      species.push({
        id: nextId('sp'),
        representative_id: genome.id,
        member_ids: [genome.id],
        niche: genome.tags.join(', ') || 'general',
        avg_fitness: 0,
        emerged_at: population.generation,
      });
    }
  }

  // Update average fitness
  for (const sp of species) {
    const fitnesses = sp.member_ids.map((id) => getFitness(id));
    sp.avg_fitness = fitnesses.length > 0
      ? fitnesses.reduce((s, f) => s + f, 0) / fitnesses.length
      : 0;
  }

  return species;
}

// ── Generational Advancement ──

export function advanceGeneration(populationId: string): AdvanceGenerationResponse | null {
  const pop = populations.get(populationId);
  if (!pop || pop.status !== 'active') return null;

  const currentGenomes = pop.genome_ids
    .map((id) => genomes.get(id))
    .filter(Boolean) as Genome[];

  if (currentGenomes.length === 0) return null;

  // Sort by fitness descending
  const ranked = [...currentGenomes].sort(
    (a, b) => getFitness(b.id) - getFitness(a.id),
  );

  const newGeneration: Genome[] = [];
  const newLineage: LineageRecord[] = [];
  let mutationsApplied = 0;
  let crossoversPerformed = 0;

  // 1. Elitism: preserve top N
  const elites = ranked.slice(0, Math.min(pop.elite_count, ranked.length));
  for (const elite of elites) {
    newGeneration.push(elite);
  }

  // 2. Fill remaining slots with crossover + mutation
  const targetSize = pop.population_size;
  const eligibleIds = ranked.map((g) => g.id);

  while (newGeneration.length < targetSize) {
    if (Math.random() < pop.crossover_rate && eligibleIds.length >= 2) {
      // Crossover
      const parentAId = selectParent(eligibleIds, pop.selection_strategy, pop.selection_pressure);
      let parentBId = selectParent(eligibleIds, pop.selection_strategy, pop.selection_pressure);
      // Avoid selfing
      let attempts = 0;
      while (parentBId === parentAId && attempts < 5) {
        parentBId = selectParent(eligibleIds, pop.selection_strategy, pop.selection_pressure);
        attempts++;
      }

      const result = crossover(
        { parent_a_id: parentAId, parent_b_id: parentBId, method: pop.crossover_method },
        populationId,
      );
      if (result) {
        // Potentially mutate offspring
        if (Math.random() < pop.mutation_rate) {
          const mutResult = mutate(
            { genome_id: result.offspring.id, mutation_types: pop.mutation_types, mutation_rate: pop.mutation_rate },
            populationId,
          );
          if (mutResult) {
            newGeneration.push(mutResult.mutant);
            newLineage.push(result.lineage, mutResult.lineage);
            mutationsApplied += mutResult.mutations.length;
            crossoversPerformed++;
            continue;
          }
        }
        newGeneration.push(result.offspring);
        newLineage.push(result.lineage);
        crossoversPerformed++;
      }
    } else {
      // Mutation only
      const parentId = selectParent(eligibleIds, pop.selection_strategy, pop.selection_pressure);
      const result = mutate(
        { genome_id: parentId, mutation_types: pop.mutation_types, mutation_rate: pop.mutation_rate * 2 },
        populationId,
      );
      if (result) {
        newGeneration.push(result.mutant);
        newLineage.push(result.lineage);
        mutationsApplied += result.mutations.length;
      }
    }
  }

  // Determine culled genomes
  const newIds = new Set(newGeneration.map((g) => g.id));
  const culledIds = pop.genome_ids.filter((id) => !newIds.has(id));

  // Update population
  pop.generation += 1;
  pop.genome_ids = newGeneration.map((g) => g.id);
  pop.updated_at = new Date().toISOString();

  // Speciation
  const oldSpeciesCount = pop.species.length;
  pop.species = speciate(pop);

  // Fitness stats
  const fitnesses = newGeneration.map((g) => getFitness(g.id));
  const bestFit = Math.max(...fitnesses, 0);
  const avgFit = fitnesses.length > 0 ? fitnesses.reduce((s, f) => s + f, 0) / fitnesses.length : 0;
  const worstFit = Math.min(...fitnesses, 0);
  const mean = avgFit;
  const variance = fitnesses.length > 0
    ? fitnesses.reduce((s, f) => s + (f - mean) ** 2, 0) / fitnesses.length
    : 0;

  // Convergence check
  if (bestFit > pop.best_fitness + pop.convergence_threshold) {
    pop.best_fitness = bestFit;
    pop.stagnation_count = 0;
  } else {
    pop.stagnation_count++;
  }

  const converged =
    pop.stagnation_count >= pop.stagnation_limit || pop.generation >= pop.max_generations;
  if (converged) {
    pop.status = 'converged';
  }

  const stats: GenerationStats = {
    generation: pop.generation,
    best_fitness: bestFit,
    avg_fitness: avgFit,
    worst_fitness: worstFit,
    fitness_std_dev: Math.sqrt(variance),
    species_count: pop.species.length,
    new_species: Math.max(0, pop.species.length - oldSpeciesCount),
    extinct_species: Math.max(0, oldSpeciesCount - pop.species.length),
    mutations_applied: mutationsApplied,
    crossovers_performed: crossoversPerformed,
    elite_preserved: elites.length,
  };

  const history = generationHistory.get(populationId) ?? [];
  history.push(stats);
  generationHistory.set(populationId, history);

  return {
    population: pop,
    new_genomes: newGeneration.filter((g) => !elites.includes(g)),
    culled_genome_ids: culledIds,
    lineage_records: newLineage,
    converged,
    generation_stats: stats,
  };
}

// ── Lineage & Genealogy ──

export function getLineage(genomeId: string): LineageResponse | null {
  const genome = genomes.get(genomeId);
  if (!genome) return null;

  const nodes: Record<string, GenealogyNode> = {};
  const rootIds: string[] = [];

  // BFS backwards through ancestry
  const queue = [genomeId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const g = genomes.get(id);
    const lr = lineageRecords.get(id);
    if (!g) continue;

    const node: GenealogyNode = {
      genome_id: id,
      agent_id: g.agent_id,
      generation: g.generation,
      fitness: fitnessScores.get(id)?.overall,
      method: lr?.method ?? 'seed',
      children_ids: [],
      parent_ids: lr?.parent_ids ?? [],
    };
    nodes[id] = node;

    if (node.parent_ids.length === 0) {
      rootIds.push(id);
    } else {
      for (const pid of node.parent_ids) {
        queue.push(pid);
      }
    }
  }

  // Forward pass: populate children_ids
  for (const node of Object.values(nodes)) {
    for (const pid of node.parent_ids) {
      if (nodes[pid]) {
        nodes[pid].children_ids.push(node.genome_id);
      }
    }
  }

  // Also traverse forward from the original genome
  const forwardQueue = [genomeId];
  const forwardVisited = new Set<string>();
  for (const [id, lr] of lineageRecords.entries()) {
    if (lr.parent_ids.includes(genomeId) && !visited.has(id)) {
      forwardQueue.push(id);
    }
  }

  while (forwardQueue.length > 0) {
    const id = forwardQueue.shift()!;
    if (forwardVisited.has(id) || visited.has(id)) continue;
    forwardVisited.add(id);

    const g = genomes.get(id);
    const lr = lineageRecords.get(id);
    if (!g || !lr) continue;

    if (!nodes[id]) {
      nodes[id] = {
        genome_id: id,
        agent_id: g.agent_id,
        generation: g.generation,
        fitness: fitnessScores.get(id)?.overall,
        method: lr.method,
        children_ids: [],
        parent_ids: lr.parent_ids,
      };
    }

    // Link parent -> child
    for (const pid of lr.parent_ids) {
      if (nodes[pid] && !nodes[pid].children_ids.includes(id)) {
        nodes[pid].children_ids.push(id);
      }
    }
  }

  const generations = Object.values(nodes).map((n) => n.generation);
  const totalGenerations = generations.length > 0 ? Math.max(...generations) + 1 : 0;

  return {
    tree: {
      root_ids: rootIds,
      nodes,
      total_generations: totalGenerations,
      total_genomes: Object.keys(nodes).length,
    },
  };
}

// ── Genome CRUD ──

export function getGenome(genomeId: string): Genome | null {
  return genomes.get(genomeId) ?? null;
}

export function listGenomesForPopulation(populationId: string): Genome[] {
  const pop = populations.get(populationId);
  if (!pop) return [];
  return pop.genome_ids.map((id) => genomes.get(id)).filter(Boolean) as Genome[];
}

// ── Reset (testing) ──

export function resetEvolutionStores(): void {
  populations.clear();
  genomes.clear();
  fitnessScores.clear();
  lineageRecords.clear();
  generationHistory.clear();
  idCounter = 0;
}
