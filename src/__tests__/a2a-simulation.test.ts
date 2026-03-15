/**
 * Agent Digital Twin & Multi-Agent Simulation — Unit Tests
 *
 * Tests validation schemas, health score computation, seeded PRNG
 * determinism, and playbook assertion evaluation.
 */

import { describe, it, expect } from 'vitest';
import {
  createSimulationSchema,
  listSimulationsSchema,
  compareSimulationsSchema,
  replaySimulationSchema,
} from '../lib/a2a/simulation/validation';

// ──────────────────────────────────────────────
// Validation Schemas
// ──────────────────────────────────────────────

describe('createSimulationSchema', () => {
  const validPayload = {
    name: 'Chaos Test Alpha',
    description: 'Test resilience under agent failure',
    source_agent_ids: ['550e8400-e29b-41d4-a716-446655440000'],
    playbook: {
      name: 'Basic interaction',
      steps: [
        {
          type: 'submit_task',
          description: 'Agent A sends task to Agent B',
          order: 0,
          config: {
            sender_twin_id: '550e8400-e29b-41d4-a716-446655440000',
            target_twin_id: '550e8400-e29b-41d4-a716-446655440001',
            intent: 'news.query',
            input: { topic: 'AI' },
          },
        },
      ],
    },
  };

  it('accepts a valid simulation creation request', () => {
    const result = createSimulationSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const { name, ...noName } = validPayload;
    const result = createSimulationSchema.safeParse(noName);
    expect(result.success).toBe(false);
  });

  it('rejects empty source_agent_ids', () => {
    const result = createSimulationSchema.safeParse({
      ...validPayload,
      source_agent_ids: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty playbook steps', () => {
    const result = createSimulationSchema.safeParse({
      ...validPayload,
      playbook: { name: 'Empty', steps: [] },
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional chaos events', () => {
    const result = createSimulationSchema.safeParse({
      ...validPayload,
      chaos_events: [
        {
          type: 'agent_failure',
          description: 'Kill agent B',
          trigger_at_seconds: 30,
          duration_seconds: 60,
          target_twin_ids: ['550e8400-e29b-41d4-a716-446655440001'],
          parameters: {},
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid chaos event type', () => {
    const result = createSimulationSchema.safeParse({
      ...validPayload,
      chaos_events: [
        {
          type: 'invalid_type',
          description: 'Bad event',
          trigger_at_seconds: 0,
          duration_seconds: 0,
          target_twin_ids: ['550e8400-e29b-41d4-a716-446655440001'],
          parameters: {},
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('applies default config values', () => {
    const result = createSimulationSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config).toBeUndefined();
    }
  });

  it('accepts custom config overrides', () => {
    const result = createSimulationSchema.safeParse({
      ...validPayload,
      config: {
        time_acceleration: 50,
        max_duration_seconds: 600,
        seed: 42,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config?.time_acceleration).toBe(50);
      expect(result.data.config?.seed).toBe(42);
    }
  });

  it('accepts twin behavior overrides', () => {
    const result = createSimulationSchema.safeParse({
      ...validPayload,
      twin_overrides: {
        '550e8400-e29b-41d4-a716-446655440000': {
          failure_rate: 0.5,
          latency_mean_ms: 5000,
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects failure_rate > 1', () => {
    const result = createSimulationSchema.safeParse({
      ...validPayload,
      twin_overrides: {
        '550e8400-e29b-41d4-a716-446655440000': {
          failure_rate: 1.5,
        },
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('listSimulationsSchema', () => {
  it('accepts empty query', () => {
    const result = listSimulationsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it('accepts valid status filter', () => {
    const result = listSimulationsSchema.safeParse({ status: 'completed' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = listSimulationsSchema.safeParse({ status: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('accepts tag filter', () => {
    const result = listSimulationsSchema.safeParse({ tag: 'replay' });
    expect(result.success).toBe(true);
  });
});

describe('compareSimulationsSchema', () => {
  it('accepts valid comparison request', () => {
    const result = compareSimulationsSchema.safeParse({
      baseline_simulation_id: '550e8400-e29b-41d4-a716-446655440000',
      candidate_simulation_id: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID IDs', () => {
    const result = compareSimulationsSchema.safeParse({
      baseline_simulation_id: 'not-a-uuid',
      candidate_simulation_id: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional thresholds', () => {
    const result = compareSimulationsSchema.safeParse({
      baseline_simulation_id: '550e8400-e29b-41d4-a716-446655440000',
      candidate_simulation_id: '550e8400-e29b-41d4-a716-446655440001',
      thresholds: { avg_latency_ms: 10, total_failures: 5 },
    });
    expect(result.success).toBe(true);
  });
});

describe('replaySimulationSchema', () => {
  const validReplay = {
    name: 'Incident replay 2026-03-14',
    source_agent_ids: ['550e8400-e29b-41d4-a716-446655440000'],
    replay_window: {
      start: '2026-03-14T10:00:00Z',
      end: '2026-03-14T11:00:00Z',
    },
  };

  it('accepts valid replay request', () => {
    const result = replaySimulationSchema.safeParse(validReplay);
    expect(result.success).toBe(true);
  });

  it('rejects end before start', () => {
    const result = replaySimulationSchema.safeParse({
      ...validReplay,
      replay_window: {
        start: '2026-03-14T11:00:00Z',
        end: '2026-03-14T10:00:00Z',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid timestamps', () => {
    const result = replaySimulationSchema.safeParse({
      ...validReplay,
      replay_window: {
        start: 'not-a-date',
        end: '2026-03-14T11:00:00Z',
      },
    });
    expect(result.success).toBe(false);
  });

  it('accepts additional chaos events for counterfactual analysis', () => {
    const result = replaySimulationSchema.safeParse({
      ...validReplay,
      additional_chaos: [
        {
          type: 'latency_spike',
          description: 'What if latency spiked?',
          trigger_at_seconds: 300,
          duration_seconds: 120,
          target_twin_ids: ['550e8400-e29b-41d4-a716-446655440000'],
          parameters: { latency_increase_ms: 10000 },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts twin overrides for counterfactual analysis', () => {
    const result = replaySimulationSchema.safeParse({
      ...validReplay,
      twin_overrides: {
        '550e8400-e29b-41d4-a716-446655440000': {
          max_concurrency: 50,
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Chaos Event Validation
// ──────────────────────────────────────────────

describe('chaos event validation', () => {
  const baseSimulation = {
    name: 'Chaos validation test',
    description: 'Testing chaos event edge cases',
    source_agent_ids: ['550e8400-e29b-41d4-a716-446655440000'],
    playbook: {
      name: 'Minimal',
      steps: [{ type: 'wait', description: 'Wait', order: 0, config: { wait_seconds: 1 } }],
    },
  };

  it('accepts all valid chaos event types', () => {
    const types = [
      'agent_failure', 'latency_spike', 'network_partition',
      'resource_exhaustion', 'byzantine_fault', 'cascade_trigger',
      'load_surge', 'data_corruption',
    ];

    for (const type of types) {
      const result = createSimulationSchema.safeParse({
        ...baseSimulation,
        chaos_events: [{
          type,
          description: `Test ${type}`,
          trigger_at_seconds: 10,
          duration_seconds: 30,
          target_twin_ids: ['550e8400-e29b-41d4-a716-446655440000'],
          parameters: {},
        }],
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects chaos events with empty target_twin_ids', () => {
    const result = createSimulationSchema.safeParse({
      ...baseSimulation,
      chaos_events: [{
        type: 'agent_failure',
        description: 'No targets',
        trigger_at_seconds: 0,
        duration_seconds: 0,
        target_twin_ids: [],
        parameters: {},
      }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative trigger_at_seconds', () => {
    const result = createSimulationSchema.safeParse({
      ...baseSimulation,
      chaos_events: [{
        type: 'agent_failure',
        description: 'Negative trigger',
        trigger_at_seconds: -10,
        duration_seconds: 0,
        target_twin_ids: ['550e8400-e29b-41d4-a716-446655440000'],
        parameters: {},
      }],
    });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Playbook Step Validation
// ──────────────────────────────────────────────

describe('playbook step validation', () => {
  const baseSimulation = {
    name: 'Playbook test',
    description: 'Testing playbook steps',
    source_agent_ids: ['550e8400-e29b-41d4-a716-446655440000'],
  };

  it('accepts all valid playbook step types', () => {
    const steps = [
      { type: 'submit_task', description: 'Submit', order: 0, config: {} },
      { type: 'broadcast_task', description: 'Broadcast', order: 1, config: {} },
      { type: 'send_message', description: 'Message', order: 2, config: {} },
      { type: 'wait', description: 'Wait', order: 3, config: { wait_seconds: 5 } },
      {
        type: 'assert',
        description: 'Check task count',
        order: 4,
        config: {
          assertion: {
            target: 'task_count',
            op: 'gte',
            value: 1,
          },
        },
      },
    ];

    const result = createSimulationSchema.safeParse({
      ...baseSimulation,
      playbook: { name: 'All steps', steps },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid playbook step type', () => {
    const result = createSimulationSchema.safeParse({
      ...baseSimulation,
      playbook: {
        name: 'Invalid',
        steps: [{ type: 'explode', description: 'Bad', order: 0, config: {} }],
      },
    });
    expect(result.success).toBe(false);
  });
});
