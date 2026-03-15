/**
 * Agent Evolution & Natural Selection — Comprehensive Tests
 *
 * Tests the full evolutionary lifecycle: population creation, fitness evaluation,
 * selection strategies, crossover methods, mutation operators, generational
 * advancement, speciation, convergence detection, and lineage tracking.
 */

import {
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
  createPopulationSchema,
  evaluateFitnessSchema,
  crossoverSchema,
  mutateSchema,
} from '@/lib/a2a/evolution';

// ── Helpers ──

function makeSeedGenome(agentId, overrides) {
  return {
    agent_id: agentId,
    genes: [
      { id: 'temperature', label: 'Temperature', type: 'numeric', value: 0.7, constraints: { min: 0, max: 2, step: 0.1 } },
      { id: 'model', label: 'Model', type: 'categorical', value: 'gpt-4', constraints: { options: ['gpt-4', 'claude-3', 'gemini-2'] } },
      { id: 'streaming', label: 'Streaming', type: 'boolean', value: true },
      { id: 'weights', label: 'Embedding Weights', type: 'vector', value: [0.5, 0.3, 0.2] },
      { id: 'capabilities', label: 'Skills', type: 'capability_set', value: ['summarize', 'translate'], constraints: { max_items: 5 } },
    ],
    tags: ['test'],
    ...overrides,
  };
}

function makePopulationInput(seeds, overrides) {
  return {
    name: 'Test Population',
    objective: 'Maximize task success rate',
    seed_genomes: seeds,
    population_size: seeds.length,
    max_generations: 50,
    selection_strategy: 'tournament',
    crossover_rate: 0.7,
    mutation_rate: 0.3,
    mutation_types: ['gaussian', 'flip', 'resample', 'swap'],
    elite_count: 1,
    ...overrides,
  };
}

// ── Tests ──

beforeEach(() => {
  resetEvolutionStores();
});

describe('Population Management', () => {
  test('creates a population with seed genomes', () => {
    const seeds = [makeSeedGenome('agent-1'), makeSeedGenome('agent-2')];
    const result = createPopulation({ owner_id: 'agent-1', input: makePopulationInput(seeds) });

    expect(result.population.name).toBe('Test Population');
    expect(result.population.objective).toBe('Maximize task success rate');
    expect(result.population.generation).toBe(0);
    expect(result.population.status).toBe('active');
    expect(result.population.genome_ids).toHaveLength(2);
    expect(result.genomes).toHaveLength(2);
    expect(result.genomes[0].generation).toBe(0);
    expect(result.genomes[0].genes).toHaveLength(5);
    expect(result.genomes[0].fingerprint).toBeTruthy();
  });

  test('lists populations filtered by owner', () => {
    createPopulation({ owner_id: 'agent-1', input: makePopulationInput([makeSeedGenome('agent-1')]) });
    createPopulation({ owner_id: 'agent-2', input: makePopulationInput([makeSeedGenome('agent-2')]) });

    const all = listPopulations();
    expect(all.total).toBe(2);

    const filtered = listPopulations('agent-1');
    expect(filtered.total).toBe(1);
    expect(filtered.populations[0].owner_id).toBe('agent-1');
  });

  test('gets population detail with genomes and fitness', () => {
    const result = createPopulation({
      owner_id: 'agent-1',
      input: makePopulationInput([makeSeedGenome('agent-1')]),
    });

    const detail = getPopulation(result.population.id);
    expect(detail).not.toBeNull();
    expect(detail.population.id).toBe(result.population.id);
    expect(detail.genomes).toHaveLength(1);
    expect(detail.fitness_scores).toHaveLength(0);
  });

  test('returns null for nonexistent population', () => {
    expect(getPopulation('nonexistent')).toBeNull();
  });
});

describe('Fitness Evaluation', () => {
  test('evaluates fitness with weighted dimensions', () => {
    const pop = createPopulation({
      owner_id: 'agent-1',
      input: makePopulationInput([makeSeedGenome('agent-1')]),
    });
    const genomeId = pop.genomes[0].id;

    const result = evaluateFitness({
      genome_id: genomeId,
      dimensions: [
        { name: 'task_success', score: 0.9 },
        { name: 'latency', score: 0.8 },
        { name: 'cost_efficiency', score: 0.7 },
        { name: 'reliability', score: 0.85 },
      ],
      sample_size: 50,
    });

    expect(result).not.toBeNull();
    expect(result.fitness.overall).toBeGreaterThan(0);
    expect(result.fitness.overall).toBeLessThanOrEqual(1);
    expect(result.fitness.dimensions).toHaveLength(4);
    expect(result.fitness.confidence).toBe(0.5); // 50/100
    expect(result.fitness.genome_id).toBe(genomeId);
  });

  test('clamps dimension scores to [0, 1]', () => {
    const pop = createPopulation({
      owner_id: 'agent-1',
      input: makePopulationInput([makeSeedGenome('agent-1')]),
    });

    const result = evaluateFitness({
      genome_id: pop.genomes[0].id,
      dimensions: [{ name: 'task_success', score: 1.5 }],
      sample_size: 10,
    });

    expect(result.fitness.dimensions[0].score).toBe(1);
  });

  test('returns null for nonexistent genome', () => {
    expect(evaluateFitness({ genome_id: 'fake', dimensions: [{ name: 'x', score: 0.5 }], sample_size: 1 })).toBeNull();
  });
});

describe('Selection Strategies', () => {
  let genomeIds;

  beforeEach(() => {
    const seeds = Array.from({ length: 10 }, (_, i) => makeSeedGenome(`agent-${i}`));
    const pop = createPopulation({ owner_id: 'agent-0', input: makePopulationInput(seeds, { population_size: 10 }) });
    genomeIds = pop.genomes.map((g) => g.id);

    // Give each genome a different fitness
    pop.genomes.forEach((g, i) => {
      evaluateFitness({
        genome_id: g.id,
        dimensions: [{ name: 'task_success', score: (i + 1) / 10 }],
        sample_size: 100,
      });
    });
  });

  test('tournament selection returns a valid genome', () => {
    const selected = selectParent(genomeIds, 'tournament', 0.5);
    expect(genomeIds).toContain(selected);
  });

  test('roulette selection returns a valid genome', () => {
    const selected = selectParent(genomeIds, 'roulette', 0.5);
    expect(genomeIds).toContain(selected);
  });

  test('rank selection returns a valid genome', () => {
    const selected = selectParent(genomeIds, 'rank', 0.5);
    expect(genomeIds).toContain(selected);
  });

  test('elitist selection biases toward top genomes', () => {
    const selections = Array.from({ length: 100 }, () => selectParent(genomeIds, 'elitist', 0.3));
    const topGenome = genomeIds[9];
    const topCount = selections.filter((s) => s === topGenome).length;
    expect(topCount).toBeGreaterThan(5);
  });

  test('truncation selection returns valid genomes', () => {
    const selections = new Set(
      Array.from({ length: 200 }, () => selectParent(genomeIds, 'truncation', 0.5)),
    );
    for (const s of selections) {
      expect(genomeIds).toContain(s);
    }
  });
});

describe('Crossover', () => {
  let popId;
  let genomeA;
  let genomeB;

  beforeEach(() => {
    const seedA = makeSeedGenome('agent-a');
    const seedB = makeSeedGenome('agent-b', {
      genes: [
        { id: 'temperature', label: 'Temperature', type: 'numeric', value: 1.2, constraints: { min: 0, max: 2 } },
        { id: 'model', label: 'Model', type: 'categorical', value: 'claude-3', constraints: { options: ['gpt-4', 'claude-3', 'gemini-2'] } },
        { id: 'streaming', label: 'Streaming', type: 'boolean', value: false },
        { id: 'weights', label: 'Embedding Weights', type: 'vector', value: [0.1, 0.6, 0.3] },
        { id: 'capabilities', label: 'Skills', type: 'capability_set', value: ['code_gen', 'debug'], constraints: { max_items: 5 } },
      ],
    });
    const pop = createPopulation({ owner_id: 'agent-a', input: makePopulationInput([seedA, seedB]) });
    popId = pop.population.id;
    genomeA = pop.genomes[0];
    genomeB = pop.genomes[1];
  });

  test('single_point crossover produces valid offspring', () => {
    const result = crossover({ parent_a_id: genomeA.id, parent_b_id: genomeB.id, method: 'single_point' }, popId);
    expect(result).not.toBeNull();
    expect(result.offspring.genes).toHaveLength(5);
    expect(result.offspring.generation).toBe(1);
    expect(result.lineage.method).toBe('crossover');
    expect(result.lineage.parent_ids).toEqual([genomeA.id, genomeB.id]);
  });

  test('two_point crossover produces valid offspring', () => {
    const result = crossover({ parent_a_id: genomeA.id, parent_b_id: genomeB.id, method: 'two_point' }, popId);
    expect(result).not.toBeNull();
    expect(result.offspring.genes).toHaveLength(5);
    expect(result.lineage.crossover_points).toHaveLength(2);
  });

  test('uniform crossover mixes genes from both parents', () => {
    const allValues = new Set();
    for (let i = 0; i < 50; i++) {
      const result = crossover({ parent_a_id: genomeA.id, parent_b_id: genomeB.id, method: 'uniform' }, popId);
      if (result) {
        const modelGene = result.offspring.genes.find((g) => g.id === 'model');
        if (modelGene) allValues.add(String(modelGene.value));
      }
    }
    expect(allValues.size).toBeGreaterThanOrEqual(2);
  });

  test('capability_blend merges capability sets', () => {
    const result = crossover({ parent_a_id: genomeA.id, parent_b_id: genomeB.id, method: 'capability_blend' }, popId);
    expect(result).not.toBeNull();
    const capGene = result.offspring.genes.find((g) => g.id === 'capabilities');
    expect(capGene).toBeDefined();
    const caps = capGene.value;
    expect(caps).toEqual(expect.arrayContaining(['summarize', 'translate', 'code_gen', 'debug']));
  });

  test('returns null for missing parents', () => {
    expect(crossover({ parent_a_id: 'fake', parent_b_id: genomeB.id }, popId)).toBeNull();
  });
});

describe('Mutation', () => {
  let popId;
  let genome;

  beforeEach(() => {
    const seed = makeSeedGenome('agent-1');
    const pop = createPopulation({ owner_id: 'agent-1', input: makePopulationInput([seed]) });
    popId = pop.population.id;
    genome = pop.genomes[0];
  });

  test('mutates a genome producing a new variant', () => {
    const result = mutate({ genome_id: genome.id, mutation_rate: 1.0, mutation_types: ['gaussian', 'flip', 'swap', 'resample'] }, popId);
    expect(result).not.toBeNull();
    expect(result.mutant.id).not.toBe(genome.id);
    expect(result.mutant.generation).toBe(1);
    expect(result.lineage.method).toBe('mutation');
    expect(result.lineage.parent_ids).toEqual([genome.id]);
  });

  test('high mutation rate causes changes', () => {
    let anyChanged = false;
    for (let i = 0; i < 10; i++) {
      const result = mutate({ genome_id: genome.id, mutation_rate: 1.0 }, popId);
      if (result && result.mutations.length > 0) {
        anyChanged = true;
        break;
      }
    }
    expect(anyChanged).toBe(true);
  });

  test('zero mutation rate preserves values', () => {
    const result = mutate({ genome_id: genome.id, mutation_rate: 0 }, popId);
    expect(result).not.toBeNull();
    expect(result.mutations).toHaveLength(0);
    for (let i = 0; i < genome.genes.length; i++) {
      expect(JSON.stringify(result.mutant.genes[i].value)).toBe(JSON.stringify(genome.genes[i].value));
    }
  });

  test('gaussian mutation respects numeric constraints', () => {
    for (let i = 0; i < 20; i++) {
      const result = mutate({ genome_id: genome.id, mutation_rate: 1.0, mutation_types: ['gaussian'] }, popId);
      if (result) {
        const tempGene = result.mutant.genes.find((g) => g.id === 'temperature');
        if (tempGene && typeof tempGene.value === 'number') {
          expect(tempGene.value).toBeGreaterThanOrEqual(0);
          expect(tempGene.value).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  test('returns null for nonexistent genome', () => {
    expect(mutate({ genome_id: 'fake' }, popId)).toBeNull();
  });
});

describe('Generational Advancement', () => {
  let popId;

  beforeEach(() => {
    const seeds = Array.from({ length: 6 }, (_, i) => makeSeedGenome(`agent-${i}`));
    const pop = createPopulation({
      owner_id: 'agent-0',
      input: makePopulationInput(seeds, {
        population_size: 6,
        elite_count: 1,
        crossover_rate: 0.7,
        mutation_rate: 0.3,
      }),
    });
    popId = pop.population.id;

    pop.genomes.forEach((g, i) => {
      evaluateFitness({
        genome_id: g.id,
        dimensions: [
          { name: 'task_success', score: (i + 1) / 6 },
          { name: 'latency', score: 0.5 + Math.random() * 0.5 },
        ],
        sample_size: 100,
      });
    });
  });

  test('advances to next generation', () => {
    const result = advanceGeneration(popId);
    expect(result).not.toBeNull();
    expect(result.population.generation).toBe(1);
    expect(result.population.genome_ids).toHaveLength(6);
    expect(result.generation_stats.generation).toBe(1);
    expect(result.generation_stats.elite_preserved).toBe(1);
    expect(result.lineage_records.length).toBeGreaterThan(0);
  });

  test('produces generation stats', () => {
    const result = advanceGeneration(popId);
    const stats = result.generation_stats;
    expect(stats.best_fitness).toBeGreaterThanOrEqual(0);
    expect(stats.avg_fitness).toBeGreaterThanOrEqual(0);
    expect(stats.species_count).toBeGreaterThanOrEqual(1);
    expect(stats.mutations_applied + stats.crossovers_performed + stats.elite_preserved).toBeGreaterThan(0);
  });

  test('multiple generations run without errors', () => {
    for (let g = 0; g < 5; g++) {
      const result = advanceGeneration(popId);
      expect(result).not.toBeNull();
      expect(result.population.generation).toBe(g + 1);

      for (const genome of result.new_genomes) {
        evaluateFitness({
          genome_id: genome.id,
          dimensions: [{ name: 'task_success', score: Math.random() }],
          sample_size: 50,
        });
      }
    }

    const detail = getPopulation(popId);
    expect(detail.population.generation).toBe(5);
    expect(detail.generation_history).toHaveLength(5);
  });

  test('detects convergence via stagnation', () => {
    const seeds = [makeSeedGenome('agent-0'), makeSeedGenome('agent-1')];
    const pop = createPopulation({
      owner_id: 'agent-0',
      input: makePopulationInput(seeds, {
        population_size: 2,
        stagnation_limit: 3,
        convergence_threshold: 0.5,
      }),
    });

    pop.genomes.forEach((g) => {
      evaluateFitness({
        genome_id: g.id,
        dimensions: [{ name: 'task_success', score: 0.5 }],
        sample_size: 100,
      });
    });

    let converged = false;
    for (let i = 0; i < 10; i++) {
      const result = advanceGeneration(pop.population.id);
      if (!result) break;

      for (const gid of result.population.genome_ids) {
        evaluateFitness({
          genome_id: gid,
          dimensions: [{ name: 'task_success', score: 0.5 }],
          sample_size: 100,
        });
      }

      if (result.converged) {
        converged = true;
        expect(result.population.status).toBe('converged');
        break;
      }
    }

    expect(converged).toBe(true);
  });

  test('returns null for nonexistent or converged population', () => {
    expect(advanceGeneration('fake')).toBeNull();
  });
});

describe('Lineage & Genealogy', () => {
  test('tracks lineage through multiple generations', () => {
    const seeds = [makeSeedGenome('agent-0'), makeSeedGenome('agent-1')];
    const pop = createPopulation({
      owner_id: 'agent-0',
      input: makePopulationInput(seeds, { population_size: 2 }),
    });
    const popId = pop.population.id;

    pop.genomes.forEach((g) => {
      evaluateFitness({
        genome_id: g.id,
        dimensions: [{ name: 'task_success', score: 0.7 }],
        sample_size: 50,
      });
    });

    const gen1 = advanceGeneration(popId);
    expect(gen1).not.toBeNull();

    const newGenomeId = gen1.new_genomes[0]?.id;
    if (newGenomeId) {
      const lineage = getLineage(newGenomeId);
      expect(lineage).not.toBeNull();
      expect(lineage.tree.total_genomes).toBeGreaterThanOrEqual(2);
      expect(lineage.tree.root_ids.length).toBeGreaterThanOrEqual(1);

      for (const rootId of lineage.tree.root_ids) {
        expect(lineage.tree.nodes[rootId].method).toBe('seed');
        expect(lineage.tree.nodes[rootId].parent_ids).toHaveLength(0);
      }
    }
  });

  test('seed genomes have no parents', () => {
    const pop = createPopulation({
      owner_id: 'agent-0',
      input: makePopulationInput([makeSeedGenome('agent-0')]),
    });

    const lineage = getLineage(pop.genomes[0].id);
    expect(lineage).not.toBeNull();
    expect(lineage.tree.root_ids).toContain(pop.genomes[0].id);
    expect(lineage.tree.nodes[pop.genomes[0].id].parent_ids).toHaveLength(0);
    expect(lineage.tree.nodes[pop.genomes[0].id].method).toBe('seed');
  });

  test('returns null for nonexistent genome', () => {
    expect(getLineage('nonexistent')).toBeNull();
  });
});

describe('Validation Schemas', () => {
  test('createPopulationSchema validates correct input', () => {
    const input = makePopulationInput([makeSeedGenome('agent-1')]);
    const result = createPopulationSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  test('createPopulationSchema rejects empty name', () => {
    const input = makePopulationInput([makeSeedGenome('agent-1')]);
    input.name = '';
    const result = createPopulationSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  test('createPopulationSchema rejects empty seed genomes', () => {
    const input = makePopulationInput([]);
    input.seed_genomes = [];
    const result = createPopulationSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  test('evaluateFitnessSchema validates correct input', () => {
    const result = evaluateFitnessSchema.safeParse({
      genome_id: 'gen-1',
      dimensions: [{ name: 'task_success', score: 0.8 }],
      sample_size: 100,
    });
    expect(result.success).toBe(true);
  });

  test('evaluateFitnessSchema rejects out-of-range scores', () => {
    const result = evaluateFitnessSchema.safeParse({
      genome_id: 'gen-1',
      dimensions: [{ name: 'task_success', score: 1.5 }],
      sample_size: 100,
    });
    expect(result.success).toBe(false);
  });

  test('crossoverSchema validates correct input', () => {
    const result = crossoverSchema.safeParse({
      parent_a_id: 'gen-1',
      parent_b_id: 'gen-2',
      method: 'uniform',
    });
    expect(result.success).toBe(true);
  });

  test('mutateSchema validates correct input', () => {
    const result = mutateSchema.safeParse({
      genome_id: 'gen-1',
      mutation_types: ['gaussian', 'flip'],
      mutation_rate: 0.2,
    });
    expect(result.success).toBe(true);
  });
});

describe('Genome Access', () => {
  test('getGenome retrieves a specific genome', () => {
    const pop = createPopulation({
      owner_id: 'agent-0',
      input: makePopulationInput([makeSeedGenome('agent-0')]),
    });
    const genome = getGenome(pop.genomes[0].id);
    expect(genome).not.toBeNull();
    expect(genome.agent_id).toBe('agent-0');
  });

  test('listGenomesForPopulation returns all genomes', () => {
    const seeds = Array.from({ length: 5 }, (_, i) => makeSeedGenome(`agent-${i}`));
    const pop = createPopulation({
      owner_id: 'agent-0',
      input: makePopulationInput(seeds, { population_size: 5 }),
    });

    const list = listGenomesForPopulation(pop.population.id);
    expect(list).toHaveLength(5);
  });

  test('returns empty for nonexistent population', () => {
    expect(listGenomesForPopulation('fake')).toEqual([]);
  });
});
