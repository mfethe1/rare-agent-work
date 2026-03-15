/**
 * A2A Swarm Intelligence Protocol — Unit Tests
 *
 * Tests validation schemas and pure functions for the swarm system.
 * Database-dependent functions are tested via integration tests.
 */

import {
  createSwarmSchema,
  joinSwarmSchema,
  depositPheromoneSchema,
  sensePheromoneSchema,
  reportSolutionSchema,
  listSwarmsSchema,
} from '@/lib/a2a/swarm/validation';
import {
  euclideanDistance,
  computeStrongestDirection,
  applyEvaporation,
  computeConcentrationIndex,
  adaptParameters,
  DEFAULT_SWARM_CONFIG,
} from '@/lib/a2a/swarm/engine';
import type { Pheromone, SwarmConfig, SwarmMetrics } from '@/lib/a2a/swarm/types';

// ──────────────────────────────────────────────
// Validation: createSwarmSchema
// ──────────────────────────────────────────────

describe('createSwarmSchema', () => {
  const validInput = {
    name: 'Optimization Swarm',
    description: 'Find optimal hyperparameters for model training',
    objective: {
      description: 'Minimize validation loss',
      domain: 'ml.hyperparameter',
      dimensions: ['learning_rate', 'batch_size', 'dropout'],
      direction: 'minimize' as const,
    },
  };

  it('accepts valid minimal input with defaults', () => {
    const result = createSwarmSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('accepts full input with custom config', () => {
    const result = createSwarmSchema.safeParse({
      ...validInput,
      config: {
        evaporation_rate: 0.1,
        evaporation_strategy: 'linear',
        min_agents: 5,
        max_agents: 500,
        default_sensing_radius: 200,
        exploration_rate: 0.5,
        convergence_criteria: 'agent_clustering',
        convergence_threshold: 0.9,
        adaptive_params: false,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const { name, ...rest } = validInput;
    const result = createSwarmSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects empty dimensions', () => {
    const result = createSwarmSchema.safeParse({
      ...validInput,
      objective: { ...validInput.objective, dimensions: [] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid direction', () => {
    const result = createSwarmSchema.safeParse({
      ...validInput,
      objective: { ...validInput.objective, direction: 'sideways' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects evaporation_rate out of range', () => {
    const result = createSwarmSchema.safeParse({
      ...validInput,
      config: { evaporation_rate: 1.5 },
    });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation: joinSwarmSchema
// ──────────────────────────────────────────────

describe('joinSwarmSchema', () => {
  it('accepts empty body (uses defaults)', () => {
    const result = joinSwarmSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts custom behaviors', () => {
    const result = joinSwarmSchema.safeParse({
      behaviors: [
        {
          type: 'attract',
          weight: 0.7,
          pheromone_triggers: ['attraction', 'success'],
          sensing_radius: 200,
        },
      ],
      initial_position: { x: 50, y: 100 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects weight > 1', () => {
    const result = joinSwarmSchema.safeParse({
      behaviors: [
        {
          type: 'attract',
          weight: 1.5,
          pheromone_triggers: ['attraction'],
          sensing_radius: 100,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty pheromone_triggers', () => {
    const result = joinSwarmSchema.safeParse({
      behaviors: [
        {
          type: 'attract',
          weight: 0.5,
          pheromone_triggers: [],
          sensing_radius: 100,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation: depositPheromoneSchema
// ──────────────────────────────────────────────

describe('depositPheromoneSchema', () => {
  it('accepts valid deposit', () => {
    const result = depositPheromoneSchema.safeParse({
      type: 'attraction',
      position: { x: 10, y: 20 },
      intensity: 5.0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.payload).toEqual({});
      expect(result.data.tags).toEqual([]);
    }
  });

  it('rejects negative intensity', () => {
    const result = depositPheromoneSchema.safeParse({
      type: 'trail',
      position: { x: 0 },
      intensity: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects intensity > 1000', () => {
    const result = depositPheromoneSchema.safeParse({
      type: 'trail',
      position: { x: 0 },
      intensity: 1001,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty position', () => {
    const result = depositPheromoneSchema.safeParse({
      type: 'trail',
      position: {},
      intensity: 1,
    });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation: sensePheromoneSchema
// ──────────────────────────────────────────────

describe('sensePheromoneSchema', () => {
  it('accepts valid sense request', () => {
    const result = sensePheromoneSchema.safeParse({
      position: { x: 50, y: 50 },
      radius: 200,
      types: ['attraction', 'success'],
      min_intensity: 0.1,
      limit: 50,
    });
    expect(result.success).toBe(true);
  });

  it('applies defaults', () => {
    const result = sensePheromoneSchema.safeParse({
      position: { x: 0 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.min_intensity).toBe(0.01);
      expect(result.data.limit).toBe(100);
    }
  });
});

// ──────────────────────────────────────────────
// Validation: reportSolutionSchema
// ──────────────────────────────────────────────

describe('reportSolutionSchema', () => {
  it('accepts valid solution', () => {
    const result = reportSolutionSchema.safeParse({
      position: { learning_rate: 0.001, batch_size: 32 },
      score: 0.95,
      payload: { model: 'bert-base', epochs: 10 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts negative scores (for minimization)', () => {
    const result = reportSolutionSchema.safeParse({
      position: { x: 1 },
      score: -100,
    });
    expect(result.success).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Validation: listSwarmsSchema
// ──────────────────────────────────────────────

describe('listSwarmsSchema', () => {
  it('accepts empty input with defaults', () => {
    const result = listSwarmsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });

  it('accepts status filter', () => {
    const result = listSwarmsSchema.safeParse({ status: 'active' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = listSwarmsSchema.safeParse({ status: 'exploding' });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Pure functions: euclideanDistance
// ──────────────────────────────────────────────

describe('euclideanDistance', () => {
  it('computes distance in 2D', () => {
    expect(euclideanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('returns 0 for same point', () => {
    expect(euclideanDistance({ x: 5, y: 10 }, { x: 5, y: 10 })).toBe(0);
  });

  it('handles 1D', () => {
    expect(euclideanDistance({ x: 0 }, { x: 7 })).toBe(7);
  });

  it('only considers shared dimensions', () => {
    expect(euclideanDistance({ x: 3, y: 4 }, { x: 0, z: 100 })).toBe(3);
  });
});

// ──────────────────────────────────────────────
// Pure functions: computeStrongestDirection
// ──────────────────────────────────────────────

describe('computeStrongestDirection', () => {
  const origin = { x: 0, y: 0 };

  function makePheromone(position: Record<string, number>, intensity: number): Pheromone {
    return {
      id: 'test',
      swarm_id: 'test',
      agent_id: 'test',
      type: 'attraction',
      position,
      intensity,
      initial_intensity: intensity,
      payload: {},
      tags: [],
      created_at: '',
      updated_at: '',
    };
  }

  it('returns null for empty array', () => {
    expect(computeStrongestDirection(origin, [])).toBeNull();
  });

  it('points toward single pheromone', () => {
    const dir = computeStrongestDirection(origin, [makePheromone({ x: 10, y: 0 }, 1)]);
    expect(dir).toEqual({ x: 10, y: 0 });
  });

  it('weights by intensity', () => {
    const dir = computeStrongestDirection(origin, [
      makePheromone({ x: 10, y: 0 }, 9),
      makePheromone({ x: 0, y: 10 }, 1),
    ]);
    // Weighted average: x = (10*9 + 0*1)/10 = 9, y = (0*9 + 10*1)/10 = 1
    expect(dir!.x).toBe(9);
    expect(dir!.y).toBe(1);
  });
});

// ──────────────────────────────────────────────
// Pure functions: applyEvaporation
// ──────────────────────────────────────────────

describe('applyEvaporation', () => {
  it('linear decay subtracts rate', () => {
    const config = { ...DEFAULT_SWARM_CONFIG, evaporation_strategy: 'linear' as const, evaporation_rate: 0.1 };
    expect(applyEvaporation(1.0, config)).toBeCloseTo(0.9);
  });

  it('linear decay floors at 0', () => {
    const config = { ...DEFAULT_SWARM_CONFIG, evaporation_strategy: 'linear' as const, evaporation_rate: 0.5 };
    expect(applyEvaporation(0.3, config)).toBe(0);
  });

  it('exponential decay multiplies', () => {
    const config = { ...DEFAULT_SWARM_CONFIG, evaporation_strategy: 'exponential' as const, evaporation_rate: 0.1 };
    expect(applyEvaporation(1.0, config)).toBeCloseTo(0.9);
  });

  it('step decay drops to 0 below threshold', () => {
    const config = { ...DEFAULT_SWARM_CONFIG, evaporation_strategy: 'step' as const, evaporation_rate: 0.5 };
    expect(applyEvaporation(0.3, config)).toBe(0);
    expect(applyEvaporation(0.6, config)).toBe(0.6);
  });
});

// ──────────────────────────────────────────────
// Pure functions: computeConcentrationIndex
// ──────────────────────────────────────────────

describe('computeConcentrationIndex', () => {
  function makePheromone(position: Record<string, number>, intensity: number): Pheromone {
    return {
      id: 'test',
      swarm_id: 'test',
      agent_id: 'test',
      type: 'attraction',
      position,
      intensity,
      initial_intensity: intensity,
      payload: {},
      tags: [],
      created_at: '',
      updated_at: '',
    };
  }

  it('returns 0 for no pheromones', () => {
    expect(computeConcentrationIndex([])).toBe(0);
  });

  it('returns 1 for single pheromone', () => {
    expect(computeConcentrationIndex([makePheromone({ x: 5 }, 1)])).toBe(1);
  });

  it('high concentration when all at same point', () => {
    const pheromones = Array.from({ length: 10 }, () => makePheromone({ x: 50, y: 50 }, 1));
    expect(computeConcentrationIndex(pheromones)).toBe(1);
  });

  it('lower concentration when spread out', () => {
    const pheromones = [
      makePheromone({ x: 0, y: 0 }, 1),
      makePheromone({ x: 1000, y: 0 }, 1),
      makePheromone({ x: 0, y: 1000 }, 1),
      makePheromone({ x: 1000, y: 1000 }, 1),
    ];
    const index = computeConcentrationIndex(pheromones);
    expect(index).toBeLessThan(0.5);
    expect(index).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────
// Pure functions: adaptParameters
// ──────────────────────────────────────────────

describe('adaptParameters', () => {
  const baseMetrics: SwarmMetrics = {
    swarm_id: 'test',
    iteration: 10,
    active_agents: 5,
    total_pheromones: 100,
    avg_intensity: 0.5,
    max_intensity: 1.0,
    concentration_index: 0.5,
    best_score: 0.9,
    avg_score: 0.7,
    improvement_rate: 0,
    recorded_at: '',
  };

  it('increases exploration when stagnant', () => {
    const result = adaptParameters(DEFAULT_SWARM_CONFIG, baseMetrics, 'stagnant');
    expect(result.exploration_rate).toBeGreaterThan(DEFAULT_SWARM_CONFIG.exploration_rate);
    expect(result.evaporation_rate).toBeLessThan(DEFAULT_SWARM_CONFIG.evaporation_rate);
  });

  it('decreases exploration when converging', () => {
    const result = adaptParameters(DEFAULT_SWARM_CONFIG, baseMetrics, 'converging');
    expect(result.exploration_rate).toBeLessThan(DEFAULT_SWARM_CONFIG.exploration_rate);
    expect(result.evaporation_rate).toBeGreaterThan(DEFAULT_SWARM_CONFIG.evaporation_rate);
  });

  it('decreases exploration when concentration is high', () => {
    const highConcentration = { ...baseMetrics, concentration_index: 0.8 };
    const result = adaptParameters(DEFAULT_SWARM_CONFIG, highConcentration, 'active');
    expect(result.exploration_rate).toBeLessThan(DEFAULT_SWARM_CONFIG.exploration_rate);
  });

  it('respects exploration_rate bounds', () => {
    const maxExplore = { ...DEFAULT_SWARM_CONFIG, exploration_rate: 0.88 };
    const result = adaptParameters(maxExplore, baseMetrics, 'stagnant');
    expect(result.exploration_rate).toBeLessThanOrEqual(0.9);

    const minExplore = { ...DEFAULT_SWARM_CONFIG, exploration_rate: 0.06 };
    const result2 = adaptParameters(minExplore, { ...baseMetrics, concentration_index: 0.8 }, 'converging');
    expect(result2.exploration_rate).toBeGreaterThanOrEqual(0.05);
  });
});
